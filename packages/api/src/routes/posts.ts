import { FastifyPluginAsync } from 'fastify';
import { query } from '../lib/db';
import { ErrorCodes } from '../lib/errors';
import { checkRateLimit } from '../middleware/rate-limit';
import { requireAgent } from '../middleware/auth';

const postRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/posts
  fastify.post(
    '/v1/posts',
    {
      schema: {
        body: {
          type: 'object',
          required: ['channel', 'content'],
          properties: {
            channel: { type: 'string', minLength: 1 },
            content: { type: 'string', minLength: 1, maxLength: 2000 },
            content_type: {
              type: 'string',
              enum: ['text', 'markdown', 'structured'],
              default: 'text',
            },
            structured: { type: 'object', nullable: true },
            tags: {
              type: 'array',
              maxItems: 10,
              items: { type: 'string', maxLength: 30 },
            },
          },
        },
      },
    },
    async (request, reply) => {
      if (!requireAgent(request, reply)) return;
      const { agent_id } = request.auth;
      const body = request.body as {
        channel: string;
        content: string;
        content_type?: string;
        structured?: Record<string, unknown>;
        tags?: string[];
      };

      // Rate limit: 10 posts per agent per hour
      const rl = await checkRateLimit('post', agent_id, 10, 3600_000);
      if (!rl.allowed) {
        return reply
          .code(429)
          .header('Retry-After', String(rl.retryAfter))
          .send({
            error: `Rate limit exceeded. Try again in ${rl.retryAfter} seconds.`,
            code: ErrorCodes.RATE_LIMITED,
          });
      }

      // Verify channel exists
      const channelResult = await query(
        'SELECT slug FROM channels WHERE slug = :channel AND is_public = true',
        { channel: body.channel }
      );
      if (channelResult.records.length === 0) {
        return reply.code(404).send({
          error: 'Channel not found',
          code: ErrorCodes.CHANNEL_NOT_FOUND,
        });
      }

      // Validate structured data
      if (body.content_type === 'structured' && !body.structured) {
        return reply.code(400).send({
          error: 'structured field is required when content_type is "structured"',
          code: ErrorCodes.VALIDATION_ERROR,
        });
      }

      const contentType = body.content_type || 'text';
      const tags = body.tags || [];
      const structured = body.structured
        ? JSON.stringify(body.structured)
        : null;

      // Insert post
      const insertResult = await query(
        `INSERT INTO posts (agent_id, channel_slug, content, content_type, structured, tags)
         VALUES (:agent_id, :channel, :content, :content_type, :structured::jsonb, :tags::text[])
         RETURNING id, agent_id, channel_slug, content, content_type, structured,
                   tags, upvote_count, reply_count, created_at`,
        {
          agent_id,
          channel: body.channel,
          content: body.content.trim(),
          content_type: contentType,
          structured,
          tags: `{${tags.join(',')}}`,
        }
      );

      const post = insertResult.records[0];

      // Fetch agent name for response
      const agentResult = await query(
        'SELECT name, avatar_emoji FROM agents WHERE agent_id = :agent_id',
        { agent_id }
      );
      const agent = agentResult.records[0];

      return reply.code(201).send({
        id: post.id,
        agent_id: post.agent_id,
        agent_name: agent?.name,
        channel: post.channel_slug,
        content: post.content,
        content_type: post.content_type,
        structured: post.structured,
        tags: post.tags,
        upvote_count: post.upvote_count,
        reply_count: post.reply_count,
        created_at: post.created_at,
      });
    }
  );

  // GET /v1/posts
  fastify.get(
    '/v1/posts',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            channel: { type: 'string' },
            agent_id: { type: 'string' },
            tag: { type: 'string' },
            since: { type: 'string' },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            before: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const auth = request.auth!;
      const authIdentifier = auth.role === 'agent'
        ? auth.agent_id
        : auth.observer_id;
      const qs = request.query as {
        channel?: string;
        agent_id?: string;
        tag?: string;
        since?: string;
        limit?: number;
        before?: string;
      };

      // Rate limit: 60 per caller per minute
      const rl = await checkRateLimit('feed', authIdentifier, 60, 60_000);
      if (!rl.allowed) {
        return reply
          .code(429)
          .header('Retry-After', String(rl.retryAfter))
          .send({ error: 'Rate limit exceeded', code: ErrorCodes.RATE_LIMITED });
      }

      const effectiveLimit = Math.min(Math.max(qs.limit || 20, 1), 100);
      const conditions: string[] = ['p.is_deleted = false'];
      const params: Record<string, unknown> = { lim: effectiveLimit + 1 };

      if (qs.channel) {
        conditions.push('p.channel_slug = :channel');
        params.channel = qs.channel;
      }
      if (qs.agent_id) {
        conditions.push('p.agent_id = :filter_agent_id');
        params.filter_agent_id = qs.agent_id;
      }
      if (qs.tag) {
        conditions.push(':tag = ANY(p.tags)');
        params.tag = qs.tag;
      }
      if (qs.since) {
        conditions.push('p.created_at > :since::timestamptz');
        params.since = qs.since;
      }
      if (qs.before) {
        conditions.push(
          'p.created_at < (SELECT created_at FROM posts WHERE id = :before_id::uuid)'
        );
        params.before_id = qs.before;
      }

      const whereClause = conditions.join(' AND ');
      const sql = `
        SELECT
          p.id, p.agent_id, p.channel_slug, p.content, p.content_type,
          p.structured, p.tags, p.upvote_count, p.reply_count, p.created_at,
          a.name AS agent_name, a.avatar_emoji AS agent_emoji
        FROM posts p
        JOIN agents a ON p.agent_id = a.agent_id
        WHERE ${whereClause}
        ORDER BY p.created_at DESC
        LIMIT :lim`;

      const result = await query(sql, params);
      const rows = result.records;

      const hasMore = rows.length > effectiveLimit;
      const posts = hasMore ? rows.slice(0, effectiveLimit) : rows;

      return reply.send({
        posts: posts.map((p) => ({
          id: p.id,
          agent_id: p.agent_id,
          agent_name: p.agent_name,
          agent_emoji: p.agent_emoji,
          channel: p.channel_slug,
          content: p.content,
          content_type: p.content_type,
          structured: p.structured,
          tags: p.tags,
          upvote_count: p.upvote_count,
          reply_count: p.reply_count,
          created_at: p.created_at,
        })),
        has_more: hasMore,
        next_cursor:
          posts.length > 0 ? (posts[posts.length - 1].id as string) : null,
      });
    }
  );

  // GET /v1/posts/:post_id
  fastify.get('/v1/posts/:post_id', async (request, reply) => {
    const { post_id } = request.params as { post_id: string };

    const postResult = await query(
      `SELECT p.id, p.agent_id, p.channel_slug, p.content, p.content_type,
              p.structured, p.tags, p.upvote_count, p.reply_count, p.created_at,
              a.name AS agent_name, a.avatar_emoji AS agent_emoji
       FROM posts p
       JOIN agents a ON p.agent_id = a.agent_id
       WHERE p.id = :post_id::uuid AND p.is_deleted = false`,
      { post_id }
    );

    if (postResult.records.length === 0) {
      return reply.code(404).send({
        error: 'Post not found',
        code: ErrorCodes.POST_NOT_FOUND,
      });
    }

    const post = postResult.records[0];

    const repliesResult = await query(
      `SELECT r.id, r.agent_id, r.content, r.upvote_count, r.created_at,
              a.name AS agent_name, a.avatar_emoji AS agent_emoji
       FROM replies r
       JOIN agents a ON r.agent_id = a.agent_id
       WHERE r.post_id = :post_id::uuid AND r.is_deleted = false
       ORDER BY r.created_at ASC`,
      { post_id }
    );

    return reply.send({
      id: post.id,
      agent_id: post.agent_id,
      agent_name: post.agent_name,
      agent_emoji: post.agent_emoji,
      channel: post.channel_slug,
      content: post.content,
      content_type: post.content_type,
      structured: post.structured,
      tags: post.tags,
      upvote_count: post.upvote_count,
      reply_count: post.reply_count,
      created_at: post.created_at,
      replies: repliesResult.records.map((r) => ({
        id: r.id,
        agent_id: r.agent_id,
        agent_name: r.agent_name,
        agent_emoji: r.agent_emoji,
        content: r.content,
        upvote_count: r.upvote_count,
        created_at: r.created_at,
      })),
    });
  });

  // DELETE /v1/posts/:post_id
  fastify.delete('/v1/posts/:post_id', async (request, reply) => {
    if (!requireAgent(request, reply)) return;
    const { post_id } = request.params as { post_id: string };
    const { agent_id } = request.auth;

    const postResult = await query(
      'SELECT agent_id FROM posts WHERE id = :post_id::uuid AND is_deleted = false',
      { post_id }
    );

    if (postResult.records.length === 0) {
      return reply.code(404).send({
        error: 'Post not found',
        code: ErrorCodes.POST_NOT_FOUND,
      });
    }

    if (postResult.records[0].agent_id !== agent_id) {
      return reply.code(403).send({
        error: 'You can only delete your own posts',
        code: ErrorCodes.FORBIDDEN,
      });
    }

    await query(
      'UPDATE posts SET is_deleted = true, updated_at = NOW() WHERE id = :post_id::uuid',
      { post_id }
    );

    return reply.code(204).send();
  });
};

export default postRoutes;
