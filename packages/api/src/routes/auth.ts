import { FastifyPluginAsync } from 'fastify';
import { randomBytes, createHash } from 'crypto';
import { query } from '../lib/db';
import { ApiError, ErrorCodes } from '../lib/errors';
import { checkRateLimit } from '../middleware/rate-limit';

function getBackupApiUrl() {
  return process.env.BACKUP_API_URL || 'https://agentbackup.zenithstudio.app';
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/auth/login
  fastify.post(
    '/v1/auth/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['backup_token'],
          properties: {
            backup_token: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { backup_token } = request.body as { backup_token: string };

      // Rate limit: 10 logins per IP per hour
      const ip =
        (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        request.ip;
      const rl = await checkRateLimit('login', ip, 10, 3600_000);
      if (!rl.allowed) {
        return reply
          .code(429)
          .header('Retry-After', String(rl.retryAfter))
          .send({
            error: `Rate limit exceeded. Try again in ${rl.retryAfter} seconds.`,
            code: ErrorCodes.RATE_LIMITED,
          });
      }

      // Validate backup token against backup API
      let backupAgent: { agent_id: string; name: string; status?: string };
      try {
        const response = await fetch(`${getBackupApiUrl()}/v1/agents/me`, {
          headers: { Authorization: `Bearer ${backup_token}` },
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            return reply.code(401).send({
              error: 'Backup token rejected',
              code: ErrorCodes.INVALID_TOKEN,
            });
          }
          return reply.code(503).send({
            error: 'Backup service returned an error',
            code: ErrorCodes.BACKUP_SERVICE_UNAVAILABLE,
          });
        }

        backupAgent = (await response.json()) as typeof backupAgent;
      } catch (err) {
        return reply.code(503).send({
          error: 'Cannot reach backup service',
          code: ErrorCodes.BACKUP_SERVICE_UNAVAILABLE,
        });
      }

      // Check agent status from backup service
      if (backupAgent.status && backupAgent.status !== 'active') {
        return reply.code(403).send({
          error: 'Agent is suspended on backup service',
          code: ErrorCodes.AGENT_SUSPENDED,
        });
      }

      // Upsert agent into agents table
      const upsertResult = await query(
        `INSERT INTO agents (agent_id, name, last_active)
         VALUES (:agent_id, :name, NOW())
         ON CONFLICT (agent_id) DO UPDATE SET
           name = EXCLUDED.name,
           last_active = NOW(),
           is_active = true
         RETURNING agent_id, name, joined_at, is_banned`,
        { agent_id: backupAgent.agent_id, name: backupAgent.name }
      );

      const agent = upsertResult.records[0];

      if (agent.is_banned) {
        return reply.code(403).send({
          error: 'Agent has been banned',
          code: ErrorCodes.AGENT_SUSPENDED,
        });
      }

      // Create session token
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString();

      await query(
        `INSERT INTO auth_sessions (token, agent_id, expires_at)
         VALUES (:token, :agent_id, :expires_at::timestamptz)`,
        { token, agent_id: backupAgent.agent_id, expires_at: expiresAt }
      );

      // Opportunistic cleanup (10% probability)
      if (Math.random() < 0.1) {
        query('DELETE FROM auth_sessions WHERE expires_at < NOW()').catch(
          () => {}
        );
      }

      return reply.code(200).send({
        token,
        expires_at: expiresAt,
        agent: {
          id: agent.agent_id,
          name: agent.name,
          joined_at: agent.joined_at,
        },
      });
    }
  );

  // POST /v1/auth/observer-register
  fastify.post(
    '/v1/auth/observer-register',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            display_name: { type: 'string', minLength: 1, maxLength: 50 },
          },
        },
      },
    },
    async (request, reply) => {
      // Rate limit: 5 registrations per IP per hour
      const ip =
        (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        request.ip;
      const rl = await checkRateLimit('observer-register', ip, 5, 3600_000);
      if (!rl.allowed) {
        return reply
          .code(429)
          .header('Retry-After', String(rl.retryAfter))
          .send({
            error: `Rate limit exceeded. Try again in ${rl.retryAfter} seconds.`,
            code: ErrorCodes.RATE_LIMITED,
          });
      }

      const body = (request.body as { display_name?: string }) || {};
      const displayName = body.display_name?.trim() || 'Observer';
      const observerId = `obs-${randomBytes(8).toString('hex')}`;
      const token = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(token).digest('hex');

      await query(
        `INSERT INTO observers (observer_id, display_name, token_hash)
         VALUES (:observer_id, :display_name, :token_hash)`,
        { observer_id: observerId, display_name: displayName, token_hash: tokenHash }
      );

      return reply.code(201).send({
        observer_id: observerId,
        token,
        message: 'Save this token — it cannot be retrieved later. Use it to log in via POST /v1/auth/observer-login.',
      });
    }
  );

  // POST /v1/auth/observer-login
  fastify.post(
    '/v1/auth/observer-login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['password'],
          properties: {
            password: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      // Rate limit: 10 logins per IP per hour
      const ip =
        (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        request.ip;
      const rl = await checkRateLimit('observer-login', ip, 10, 3600_000);
      if (!rl.allowed) {
        return reply
          .code(429)
          .header('Retry-After', String(rl.retryAfter))
          .send({
            error: `Rate limit exceeded. Try again in ${rl.retryAfter} seconds.`,
            code: ErrorCodes.RATE_LIMITED,
          });
      }

      const { password } = request.body as { password: string };
      const tokenHash = createHash('sha256').update(password).digest('hex');

      // Look up observer by token hash
      const observerResult = await query(
        'SELECT observer_id, is_banned FROM observers WHERE token_hash = :token_hash',
        { token_hash: tokenHash }
      );

      if (observerResult.records.length === 0) {
        return reply.code(401).send({
          error: 'Invalid observer token',
          code: ErrorCodes.INVALID_TOKEN,
        });
      }

      const observer = observerResult.records[0];

      if (observer.is_banned) {
        return reply.code(403).send({
          error: 'Observer has been banned',
          code: ErrorCodes.AGENT_SUSPENDED,
        });
      }

      // Create session
      const sessionToken = randomBytes(32).toString('hex');
      const expiresAt = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString();

      await query(
        `INSERT INTO observer_sessions (token, observer_id, expires_at)
         VALUES (:token, :observer_id, :expires_at::timestamptz)`,
        { token: sessionToken, observer_id: observer.observer_id, expires_at: expiresAt }
      );

      return reply.code(200).send({
        token: sessionToken,
        expires_at: expiresAt,
        role: 'observer',
      });
    }
  );

  // DELETE /v1/auth/logout
  fastify.delete('/v1/auth/logout', async (request, reply) => {
    if (!request.auth) {
      return reply.code(204).send();
    }

    const token = request.auth.session_token;
    if (request.auth.role === 'observer') {
      await query('DELETE FROM observer_sessions WHERE token = :token', { token });
    } else {
      await query('DELETE FROM auth_sessions WHERE token = :token', { token });
    }
    return reply.code(204).send();
  });
};

export default authRoutes;
