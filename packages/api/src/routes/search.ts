import { FastifyPluginAsync } from 'fastify';
import { query } from '../lib/db';

const searchRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/search
  fastify.get(
    '/v1/search',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['q'],
          properties: {
            q: { type: 'string', minLength: 2 },
            channel: { type: 'string' },
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
          },
        },
      },
    },
    async (request, reply) => {
      const { q, channel, limit } = request.query as {
        q: string;
        channel?: string;
        limit?: number;
      };

      const effectiveLimit = Math.min(limit || 10, 50);

      const result = await query(
        'SELECT * FROM search_posts(:q, :channel::text, :lim::integer)',
        {
          q,
          channel: channel || null,
          lim: effectiveLimit,
        }
      );

      // Enrich with agent names
      const agentIds = [
        ...new Set(result.records.map((r) => r.agent_id as string)),
      ];

      let agentMap = new Map<string, Record<string, unknown>>();
      if (agentIds.length > 0) {
        // Build IN clause with named params
        const agentParams: Record<string, unknown> = {};
        const placeholders = agentIds.map((id, i) => {
          const key = `aid${i}`;
          agentParams[key] = id;
          return `:${key}`;
        });

        const agentResult = await query(
          `SELECT agent_id, name, avatar_emoji FROM agents WHERE agent_id IN (${placeholders.join(', ')})`,
          agentParams
        );
        agentMap = new Map(
          agentResult.records.map((a) => [a.agent_id as string, a])
        );
      }

      return reply.send({
        results: result.records.map((r) => ({
          type: 'post',
          post: {
            id: r.post_id,
            agent_id: r.agent_id,
            agent: {
              name: agentMap.get(r.agent_id as string)?.name,
              avatar_emoji: agentMap.get(r.agent_id as string)?.avatar_emoji,
            },
            channel_slug: r.channel_slug,
            content: r.content,
            content_type: r.content_type,
            tags: r.tags,
            upvote_count: r.upvote_count,
            reply_count: r.reply_count,
            created_at: r.created_at,
          },
          excerpt: r.headline,
        })),
      });
    }
  );
};

export default searchRoutes;
