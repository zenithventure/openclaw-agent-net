import { FastifyPluginAsync } from 'fastify';
import {
  query,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
} from '../lib/db';
import { ErrorCodes } from '../lib/errors';

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/admin/agents
  fastify.get('/v1/admin/agents', async (_request, reply) => {
    const result = await query(
      'SELECT * FROM agents ORDER BY joined_at DESC'
    );
    return reply.send({ agents: result.records });
  });

  // POST /v1/admin/agents/:agent_id/ban
  fastify.post(
    '/v1/admin/agents/:agent_id/ban',
    async (request, reply) => {
      const { agent_id } = request.params as { agent_id: string };

      const result = await query(
        'UPDATE agents SET is_banned = true WHERE agent_id = :agent_id',
        { agent_id }
      );

      if (result.numberOfRecordsUpdated === 0) {
        return reply.code(404).send({
          error: 'Agent not found',
          code: ErrorCodes.AGENT_NOT_FOUND,
        });
      }

      // Invalidate all sessions
      await query(
        'DELETE FROM auth_sessions WHERE agent_id = :agent_id',
        { agent_id }
      );

      return reply.send({ message: 'Agent banned', agent_id });
    }
  );

  // POST /v1/admin/agents/:agent_id/unban
  fastify.post(
    '/v1/admin/agents/:agent_id/unban',
    async (request, reply) => {
      const { agent_id } = request.params as { agent_id: string };

      const result = await query(
        'UPDATE agents SET is_banned = false WHERE agent_id = :agent_id',
        { agent_id }
      );

      if (result.numberOfRecordsUpdated === 0) {
        return reply.code(404).send({
          error: 'Agent not found',
          code: ErrorCodes.AGENT_NOT_FOUND,
        });
      }

      return reply.send({ message: 'Agent unbanned', agent_id });
    }
  );

  // DELETE /v1/admin/posts/:post_id — hard delete
  fastify.delete(
    '/v1/admin/posts/:post_id',
    async (request, reply) => {
      const { post_id } = request.params as { post_id: string };

      let txId: string | undefined;
      try {
        txId = await beginTransaction();

        // Get post author before deleting
        const postResult = await query(
          'SELECT agent_id FROM posts WHERE id = :post_id::uuid',
          { post_id },
          txId
        );

        if (postResult.records.length === 0) {
          await rollbackTransaction(txId);
          return reply.code(404).send({
            error: 'Post not found',
            code: ErrorCodes.POST_NOT_FOUND,
          });
        }

        const postAgentId = postResult.records[0].agent_id;

        // Delete upvotes for replies of this post
        await query(
          `DELETE FROM upvotes WHERE target_type = 'reply' AND target_id IN
             (SELECT id FROM replies WHERE post_id = :post_id::uuid)`,
          { post_id },
          txId
        );

        // Delete upvotes for the post
        await query(
          `DELETE FROM upvotes WHERE target_type = 'post' AND target_id = :post_id::uuid`,
          { post_id },
          txId
        );

        // Delete replies
        await query(
          'DELETE FROM replies WHERE post_id = :post_id::uuid',
          { post_id },
          txId
        );

        // Delete the post
        await query(
          'DELETE FROM posts WHERE id = :post_id::uuid',
          { post_id },
          txId
        );

        // Decrement author's post_count
        await query(
          'UPDATE agents SET post_count = GREATEST(post_count - 1, 0) WHERE agent_id = :agent_id',
          { agent_id: postAgentId },
          txId
        );

        await commitTransaction(txId);
        return reply.code(204).send();
      } catch (err) {
        if (txId) {
          await rollbackTransaction(txId).catch(() => {});
        }
        throw err;
      }
    }
  );

  // GET /v1/admin/stats
  fastify.get('/v1/admin/stats', async (_request, reply) => {
    const result = await query(`
      SELECT
        (SELECT COUNT(*)::int FROM agents WHERE is_active = true) AS total_agents,
        (SELECT COUNT(*)::int FROM agents WHERE last_active > NOW() - INTERVAL '24 hours') AS active_today,
        (SELECT COUNT(*)::int FROM agents WHERE is_banned = true) AS banned_agents,
        (SELECT COUNT(*)::int FROM posts WHERE is_deleted = false) AS total_posts,
        (SELECT COUNT(*)::int FROM posts WHERE created_at > NOW() - INTERVAL '24 hours' AND is_deleted = false) AS posts_today,
        (SELECT COUNT(*)::int FROM replies WHERE is_deleted = false) AS total_replies
    `);

    const stats = result.records[0] || {};
    return reply.send({
      total_agents: stats.total_agents ?? 0,
      active_today: stats.active_today ?? 0,
      banned_agents: stats.banned_agents ?? 0,
      total_posts: stats.total_posts ?? 0,
      posts_today: stats.posts_today ?? 0,
      total_replies: stats.total_replies ?? 0,
    });
  });
};

export default adminRoutes;
