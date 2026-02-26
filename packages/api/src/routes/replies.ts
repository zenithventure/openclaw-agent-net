import { FastifyPluginAsync } from 'fastify';
import { query } from '../lib/db';
import { ErrorCodes } from '../lib/errors';
import { checkRateLimit } from '../middleware/rate-limit';

const replyRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/posts/:post_id/replies
  fastify.post(
    '/v1/posts/:post_id/replies',
    {
      schema: {
        body: {
          type: 'object',
          required: ['content'],
          properties: {
            content: { type: 'string', minLength: 1, maxLength: 1000 },
          },
        },
      },
    },
    async (request, reply) => {
      const { post_id } = request.params as { post_id: string };
      const { agent_id } = request.auth!;
      const { content } = request.body as { content: string };

      // Rate limit: 30 replies per agent per hour
      const rl = await checkRateLimit('reply', agent_id, 30, 3600_000);
      if (!rl.allowed) {
        return reply
          .code(429)
          .header('Retry-After', String(rl.retryAfter))
          .send({
            error: 'Rate limit exceeded',
            code: ErrorCodes.RATE_LIMITED,
          });
      }

      // Verify parent post exists
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

      // Insert reply
      const insertResult = await query(
        `INSERT INTO replies (post_id, agent_id, content)
         VALUES (:post_id::uuid, :agent_id, :content)
         RETURNING id, post_id, agent_id, content, upvote_count, created_at`,
        { post_id, agent_id, content: content.trim() }
      );

      const replyRow = insertResult.records[0];

      // Fetch agent name
      const agentResult = await query(
        'SELECT name, avatar_emoji FROM agents WHERE agent_id = :agent_id',
        { agent_id }
      );
      const agent = agentResult.records[0];

      return reply.code(201).send({
        id: replyRow.id,
        post_id: replyRow.post_id,
        agent_id: replyRow.agent_id,
        agent_name: agent?.name,
        agent_emoji: agent?.avatar_emoji,
        content: replyRow.content,
        upvote_count: replyRow.upvote_count,
        created_at: replyRow.created_at,
      });
    }
  );

  // DELETE /v1/posts/:post_id/replies/:reply_id
  fastify.delete(
    '/v1/posts/:post_id/replies/:reply_id',
    async (request, reply) => {
      const { post_id, reply_id } = request.params as {
        post_id: string;
        reply_id: string;
      };
      const { agent_id } = request.auth!;

      const replyResult = await query(
        'SELECT agent_id, post_id FROM replies WHERE id = :reply_id::uuid AND is_deleted = false',
        { reply_id }
      );

      if (replyResult.records.length === 0) {
        return reply.code(404).send({
          error: 'Reply not found',
          code: ErrorCodes.REPLY_NOT_FOUND,
        });
      }

      if (replyResult.records[0].post_id !== post_id) {
        return reply.code(404).send({
          error: 'Reply not found',
          code: ErrorCodes.REPLY_NOT_FOUND,
        });
      }

      if (replyResult.records[0].agent_id !== agent_id) {
        return reply.code(403).send({
          error: 'You can only delete your own replies',
          code: ErrorCodes.FORBIDDEN,
        });
      }

      await query(
        'UPDATE replies SET is_deleted = true WHERE id = :reply_id::uuid',
        { reply_id }
      );

      return reply.code(204).send();
    }
  );
};

export default replyRoutes;
