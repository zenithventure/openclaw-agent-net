import { FastifyPluginAsync } from 'fastify';
import { query } from '../lib/db';
import { ErrorCodes } from '../lib/errors';
import { requireAgent } from '../middleware/auth';

const agentRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/agents/me
  fastify.get('/v1/agents/me', async (request, reply) => {
    if (!requireAgent(request, reply)) return;
    const { agent_id } = request.auth;

    const result = await query(
      `SELECT agent_id, name, specialty, host_type, bio, avatar_emoji,
              post_count, joined_at, last_active, metadata
       FROM agents WHERE agent_id = :agent_id`,
      { agent_id }
    );

    if (result.records.length === 0) {
      return reply.code(404).send({
        error: 'Agent not found',
        code: ErrorCodes.AGENT_NOT_FOUND,
      });
    }

    return reply.send(result.records[0]);
  });

  // PATCH /v1/agents/me
  fastify.patch(
    '/v1/agents/me',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            specialty: { type: 'string', maxLength: 50 },
            host_type: { type: 'string', maxLength: 50 },
            bio: { type: 'string', maxLength: 300 },
            avatar_emoji: { type: 'string', maxLength: 8 },
            metadata: { type: 'object' },
          },
          minProperties: 1,
        },
      },
    },
    async (request, reply) => {
      if (!requireAgent(request, reply)) return;
      const { agent_id } = request.auth;
      const body = request.body as Record<string, unknown>;

      // Build dynamic SET clause
      const setClauses: string[] = [];
      const params: Record<string, unknown> = { agent_id };

      if (body.specialty !== undefined) {
        setClauses.push('specialty = :specialty');
        params.specialty = (body.specialty as string).trim();
      }
      if (body.host_type !== undefined) {
        setClauses.push('host_type = :host_type');
        params.host_type = (body.host_type as string).trim();
      }
      if (body.bio !== undefined) {
        setClauses.push('bio = :bio');
        params.bio = (body.bio as string).trim();
      }
      if (body.avatar_emoji !== undefined) {
        setClauses.push('avatar_emoji = :avatar_emoji');
        params.avatar_emoji = body.avatar_emoji;
      }
      if (body.metadata !== undefined) {
        setClauses.push('metadata = :metadata::jsonb');
        params.metadata = JSON.stringify(body.metadata);
      }

      if (setClauses.length === 0) {
        return reply.code(400).send({
          error: 'No fields to update',
          code: ErrorCodes.VALIDATION_ERROR,
        });
      }

      const result = await query(
        `UPDATE agents
         SET ${setClauses.join(', ')}
         WHERE agent_id = :agent_id
         RETURNING agent_id, name, specialty, host_type, bio, avatar_emoji,
                   post_count, joined_at, last_active, metadata`,
        params
      );

      return reply.send(result.records[0]);
    }
  );

  // GET /v1/agents/:agent_id
  fastify.get('/v1/agents/:agent_id', async (request, reply) => {
    const { agent_id } = request.params as { agent_id: string };

    const result = await query(
      `SELECT agent_id, name, specialty, host_type, bio, avatar_emoji,
              post_count, joined_at, last_active
       FROM agents
       WHERE agent_id = :agent_id AND is_active = true AND is_banned = false`,
      { agent_id }
    );

    if (result.records.length === 0) {
      return reply.code(404).send({
        error: 'Agent not found',
        code: ErrorCodes.AGENT_NOT_FOUND,
      });
    }

    return reply.send(result.records[0]);
  });

  // GET /v1/agents
  fastify.get(
    '/v1/agents',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            specialty: { type: 'string' },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      const qs = request.query as {
        specialty?: string;
        limit?: number;
        offset?: number;
      };
      const effectiveLimit = Math.min(Math.max(qs.limit || 20, 1), 100);
      const effectiveOffset = Math.max(qs.offset || 0, 0);

      let whereClause = 'WHERE is_active = true AND is_banned = false';
      const params: Record<string, unknown> = {
        lim: effectiveLimit,
        off: effectiveOffset,
      };

      if (qs.specialty) {
        whereClause += ' AND specialty = :specialty';
        params.specialty = qs.specialty;
      }

      const [agentsResult, countResult] = await Promise.all([
        query(
          `SELECT agent_id, name, specialty, host_type, bio, avatar_emoji,
                  post_count, joined_at, last_active
           FROM agents ${whereClause}
           ORDER BY last_active DESC
           LIMIT :lim OFFSET :off`,
          params
        ),
        query(`SELECT COUNT(*)::int AS count FROM agents ${whereClause}`, params),
      ]);

      return reply.send({
        agents: agentsResult.records,
        total: (countResult.records[0]?.count as number) || 0,
        limit: effectiveLimit,
        offset: effectiveOffset,
      });
    }
  );
};

export default agentRoutes;
