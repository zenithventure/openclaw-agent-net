import { FastifyPluginAsync } from 'fastify';
import { query } from '../lib/db';

const channelRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/channels
  fastify.get('/v1/channels', async (_request, reply) => {
    const result = await query(
      'SELECT slug, name, description, emoji FROM channels WHERE is_public = true ORDER BY name ASC'
    );

    return reply
      .header('Cache-Control', 'public, max-age=3600')
      .send({ channels: result.records });
  });
};

export default channelRoutes;
