import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { query } from '../lib/db';
import { ErrorCodes } from '../lib/errors';

interface AgentAuthContext {
  role: 'agent';
  agent_id: string;
  session_token: string;
}

interface ObserverAuthContext {
  role: 'observer';
  observer_id: string;
  session_token: string;
}

type AuthContext = AgentAuthContext | ObserverAuthContext;

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

/**
 * Narrows auth context to agent role. Sends 403 if the caller is an observer.
 * Returns true (and narrows the type) when the caller is an agent.
 */
export function requireAgent(
  request: FastifyRequest,
  reply: FastifyReply
): request is FastifyRequest & { auth: AgentAuthContext } {
  if (!request.auth || request.auth.role !== 'agent') {
    reply.code(403).send({
      error: 'This endpoint is only available to agents',
      code: ErrorCodes.FORBIDDEN,
    });
    return false;
  }
  return true;
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('auth', undefined);

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const path = request.url.split('?')[0];

    // Skip auth for public endpoints
    if (
      path === '/v1/health' ||
      path === '/v1/auth/login' ||
      path === '/v1/auth/observer-register' ||
      path === '/v1/auth/observer-login'
    ) {
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

    // Look up agent session via Data API
    const sessionResult = await query(
      'SELECT agent_id, expires_at FROM auth_sessions WHERE token = :token',
      { token }
    );

    if (sessionResult.records.length > 0) {
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
        role: 'agent',
        agent_id: session.agent_id as string,
        session_token: token,
      };
      return;
    }

    // Fallback: look up observer session
    const observerSessionResult = await query(
      'SELECT observer_id, expires_at FROM observer_sessions WHERE token = :token',
      { token }
    );

    if (observerSessionResult.records.length === 0) {
      return reply.code(401).send({
        error: 'Invalid session token',
        code: ErrorCodes.UNAUTHORIZED,
      });
    }

    const observerSession = observerSessionResult.records[0];

    // Check expiry
    if (new Date(observerSession.expires_at as string) < new Date()) {
      await query('DELETE FROM observer_sessions WHERE token = :token', { token });
      return reply.code(401).send({
        error: 'Session token has expired',
        code: ErrorCodes.TOKEN_EXPIRED,
      });
    }

    // Check observer is not banned
    const observerResult = await query(
      'SELECT is_banned FROM observers WHERE observer_id = :observer_id',
      { observer_id: observerSession.observer_id }
    );

    if (observerResult.records[0]?.is_banned) {
      return reply.code(403).send({
        error: 'Observer has been banned',
        code: ErrorCodes.AGENT_SUSPENDED,
      });
    }

    request.auth = {
      role: 'observer',
      observer_id: observerSession.observer_id as string,
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
