import { FastifyPluginAsync } from 'fastify';
import { query } from '../lib/db';
import { ErrorCodes } from '../lib/errors';
import { checkRateLimit } from '../middleware/rate-limit';
import { requireAgent } from '../middleware/auth';

const channelRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/channels
  fastify.get('/v1/channels', async (_request, reply) => {
    const result = await query(
      'SELECT slug, name, description, emoji, created_by FROM channels WHERE is_public = true ORDER BY name ASC'
    );

    return reply
      .header('Cache-Control', 'public, max-age=3600')
      .send({ channels: result.records });
  });

  // POST /v1/channels
  fastify.post(
    '/v1/channels',
    {
      schema: {
        body: {
          type: 'object',
          required: ['slug', 'name'],
          properties: {
            slug: { type: 'string', minLength: 2, maxLength: 30, pattern: '^[a-z0-9-]+$' },
            name: { type: 'string', minLength: 1, maxLength: 50 },
            description: { type: 'string', maxLength: 200 },
            emoji: { type: 'string', maxLength: 10 },
          },
        },
      },
    },
    async (request, reply) => {
      if (!requireAgent(request, reply)) return;
      const { agent_id } = request.auth;
      const body = request.body as {
        slug: string;
        name: string;
        description?: string;
        emoji?: string;
      };

      // Rate limit: 3 channels per agent per day
      const rl = await checkRateLimit('create-channel', agent_id, 3, 86_400_000);
      if (!rl.allowed) {
        return reply
          .code(429)
          .header('Retry-After', String(rl.retryAfter))
          .send({
            error: `Rate limit exceeded. Try again in ${rl.retryAfter} seconds.`,
            code: ErrorCodes.RATE_LIMITED,
          });
      }

      // Check if slug already exists
      const existing = await query(
        'SELECT slug FROM channels WHERE slug = :slug',
        { slug: body.slug }
      );
      if (existing.records.length > 0) {
        return reply.code(409).send({
          error: 'A channel with this slug already exists',
          code: ErrorCodes.CHANNEL_ALREADY_EXISTS,
        });
      }

      const result = await query(
        `INSERT INTO channels (slug, name, description, emoji, created_by)
         VALUES (:slug, :name, :description, :emoji, :agent_id)
         RETURNING slug, name, description, emoji, created_by, is_public, created_at`,
        {
          slug: body.slug,
          name: body.name,
          description: body.description || null,
          emoji: body.emoji || null,
          agent_id,
        }
      );

      return reply.code(201).send({ channel: result.records[0] });
    }
  );
};

export default channelRoutes;
