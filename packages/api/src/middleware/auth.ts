import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { query } from '../lib/db';
import { ErrorCodes } from '../lib/errors';

interface AuthContext {
  agent_id: string;
  session_token: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('auth', undefined);

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const path = request.url.split('?')[0];

    // Skip auth for public endpoints
    if (path === '/v1/health' || path === '/v1/auth/login') {
      return;
    }

    // Admin endpoints use separate auth
    if (path.startsWith('/v1/admin')) {
      return authenticateAdmin(request, reply);
    }

    // Agent auth - require Bearer token
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({
        error: 'Missing or invalid Authorization header',
        code: ErrorCodes.UNAUTHORIZED,
      });
    }

    const token = authHeader.slice(7);

    // Look up session via Data API
    const sessionResult = await query(
      'SELECT agent_id, expires_at FROM auth_sessions WHERE token = :token',
      { token }
    );

    if (sessionResult.records.length === 0) {
      return reply.code(401).send({
        error: 'Invalid session token',
        code: ErrorCodes.UNAUTHORIZED,
      });
    }

    const session = sessionResult.records[0];

    // Check expiry
    if (new Date(session.expires_at as string) < new Date()) {
      await query('DELETE FROM auth_sessions WHERE token = :token', { token });
      return reply.code(401).send({
        error: 'Session token has expired',
        code: ErrorCodes.TOKEN_EXPIRED,
      });
    }

    // Check agent is not banned
    const agentResult = await query(
      'SELECT is_banned FROM agents WHERE agent_id = :agent_id',
      { agent_id: session.agent_id }
    );

    if (agentResult.records[0]?.is_banned) {
      return reply.code(403).send({
        error: 'Agent has been banned',
        code: ErrorCodes.AGENT_SUSPENDED,
      });
    }

    // Fire-and-forget: update last_active
    query(
      'UPDATE agents SET last_active = NOW() WHERE agent_id = :agent_id',
      { agent_id: session.agent_id }
    ).catch(() => {});

    request.auth = {
      agent_id: session.agent_id as string,
      session_token: token,
    };
  });
};

async function authenticateAdmin(request: FastifyRequest, reply: FastifyReply) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return reply.code(500).send({
      error: 'Admin auth not configured',
      code: ErrorCodes.INTERNAL_ERROR,
    });
  }

  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({
      error: 'Missing Authorization header',
      code: ErrorCodes.UNAUTHORIZED,
    });
  }

  const token = authHeader.slice(7);
  if (token !== adminSecret) {
    return reply.code(403).send({
      error: 'Invalid admin token',
      code: ErrorCodes.FORBIDDEN,
    });
  }
}

export default fp(authPlugin, { name: 'auth' });
