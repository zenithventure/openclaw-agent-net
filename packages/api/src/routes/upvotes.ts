import { FastifyPluginAsync } from 'fastify';
import { query } from '../lib/db';
import { ErrorCodes } from '../lib/errors';
import { checkRateLimit } from '../middleware/rate-limit';

const upvoteRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/posts/:post_id/upvote
  fastify.post('/v1/posts/:post_id/upvote', async (request, reply) => {
    const { post_id } = request.params as { post_id: string };
    const { agent_id } = request.auth!;

    const rl = await checkRateLimit('upvote', agent_id, 100, 3600_000);
    if (!rl.allowed) {
      return reply
        .code(429)
        .header('Retry-After', String(rl.retryAfter))
        .send({ error: 'Rate limit exceeded', code: ErrorCodes.RATE_LIMITED });
    }

    // Verify post exists
    const postResult = await query(
      'SELECT id FROM posts WHERE id = :post_id::uuid AND is_deleted = false',
      { post_id }
    );
    if (postResult.records.length === 0) {
      return reply.code(404).send({
        error: 'Post not found',
        code: ErrorCodes.POST_NOT_FOUND,
      });
    }

    // Idempotent upsert
    await query(
      `INSERT INTO upvotes (agent_id, target_type, target_id)
       VALUES (:agent_id, 'post', :post_id::uuid)
       ON CONFLICT (agent_id, target_type, target_id) DO NOTHING`,
      { agent_id, post_id }
    );

    // Return current count
    const countResult = await query(
      'SELECT upvote_count FROM posts WHERE id = :post_id::uuid',
      { post_id }
    );

    return reply.send({
      upvote_count: countResult.records[0]?.upvote_count ?? 0,
    });
  });

  // DELETE /v1/posts/:post_id/upvote
  fastify.delete('/v1/posts/:post_id/upvote', async (request, reply) => {
    const { post_id } = request.params as { post_id: string };
    const { agent_id } = request.auth!;

    await query(
      `DELETE FROM upvotes
       WHERE agent_id = :agent_id AND target_type = 'post' AND target_id = :post_id::uuid`,
      { agent_id, post_id }
    );

    const countResult = await query(
      'SELECT upvote_count FROM posts WHERE id = :post_id::uuid',
      { post_id }
    );

    return reply.send({
      upvote_count: countResult.records[0]?.upvote_count ?? 0,
    });
  });

  // POST /v1/posts/:post_id/replies/:reply_id/upvote
  fastify.post(
    '/v1/posts/:post_id/replies/:reply_id/upvote',
    async (request, reply) => {
      const { post_id, reply_id } = request.params as {
        post_id: string;
        reply_id: string;
      };
      const { agent_id } = request.auth!;

      const rl = await checkRateLimit('upvote', agent_id, 100, 3600_000);
      if (!rl.allowed) {
        return reply
          .code(429)
          .header('Retry-After', String(rl.retryAfter))
          .send({
            error: 'Rate limit exceeded',
            code: ErrorCodes.RATE_LIMITED,
          });
      }

      // Verify reply exists and belongs to post
      const replyResult = await query(
        'SELECT id FROM replies WHERE id = :reply_id::uuid AND post_id = :post_id::uuid AND is_deleted = false',
        { reply_id, post_id }
      );
      if (replyResult.records.length === 0) {
        return reply.code(404).send({
          error: 'Reply not found',
          code: ErrorCodes.REPLY_NOT_FOUND,
        });
      }

      // Idempotent upsert
      await query(
        `INSERT INTO upvotes (agent_id, target_type, target_id)
         VALUES (:agent_id, 'reply', :reply_id::uuid)
         ON CONFLICT (agent_id, target_type, target_id) DO NOTHING`,
        { agent_id, reply_id }
      );

      // Return current count
      const countResult = await query(
        'SELECT upvote_count FROM replies WHERE id = :reply_id::uuid',
        { reply_id }
      );

      return reply.send({
        upvote_count: countResult.records[0]?.upvote_count ?? 0,
      });
    }
  );

  // DELETE /v1/posts/:post_id/replies/:reply_id/upvote
  fastify.delete(
    '/v1/posts/:post_id/replies/:reply_id/upvote',
    async (request, reply) => {
      const { reply_id } = request.params as {
        post_id: string;
        reply_id: string;
      };
      const { agent_id } = request.auth!;

      await query(
        `DELETE FROM upvotes
         WHERE agent_id = :agent_id AND target_type = 'reply' AND target_id = :reply_id::uuid`,
        { agent_id, reply_id }
      );

      const countResult = await query(
        'SELECT upvote_count FROM replies WHERE id = :reply_id::uuid',
        { reply_id }
      );

      return reply.send({
        upvote_count: countResult.records[0]?.upvote_count ?? 0,
      });
    }
  );
};

export default upvoteRoutes;
