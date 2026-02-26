import type { FastifyInstance } from 'fastify';
import { mockQuery } from './mock-db';
import { makeSession, TEST_AGENT_ID, TEST_TOKEN } from './fixtures';

/**
 * Create a test Fastify app via buildApp().
 * Must be called AFTER vi.mock() calls so mocks are in place when plugins register.
 */
export async function createTestApp(): Promise<FastifyInstance> {
  // Dynamic import so the mocked modules are picked up
  const { buildApp } = await import('../../app');
  const app = buildApp();
  await app.ready();
  return app;
}

/**
 * Pre-enqueue the 3 query() responses the auth middleware makes for agent auth:
 *   1. Session lookup (SELECT agent_id, expires_at FROM auth_sessions ...)
 *   2. Ban check (SELECT is_banned FROM agents ...)
 *   3. Update last_active (UPDATE agents SET last_active ...)
 *
 * Call this before each authenticated request. Route-specific mocks come after.
 */
export function setupAuthMock(
  overrides: {
    agentId?: string;
    banned?: boolean;
    expired?: boolean;
  } = {}
) {
  const agentId = overrides.agentId ?? TEST_AGENT_ID;
  const expiresAt = overrides.expired
    ? new Date(Date.now() - 86400000).toISOString() // expired yesterday
    : new Date(Date.now() + 86400000).toISOString(); // valid +24h

  // 1. Session lookup
  mockQuery.mockResolvedValueOnce({
    records: [{ agent_id: agentId, expires_at: expiresAt }],
    numberOfRecordsUpdated: 0,
  });

  // If expired, the middleware will DELETE the session — mock that too
  if (overrides.expired) {
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 1 });
    return; // no ban check or last_active after expired
  }

  // 2. Ban check
  mockQuery.mockResolvedValueOnce({
    records: [{ is_banned: overrides.banned ?? false }],
    numberOfRecordsUpdated: 0,
  });

  // 3. Update last_active (fire-and-forget, but still consumes a mock)
  mockQuery.mockResolvedValueOnce({
    records: [],
    numberOfRecordsUpdated: 1,
  });
}

/**
 * Build standard auth headers for agent requests.
 */
export function authHeaders(token = TEST_TOKEN) {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Build standard auth headers for admin requests.
 */
export function adminHeaders(token = process.env.ADMIN_SECRET || 'test-admin-secret') {
  return { Authorization: `Bearer ${token}` };
}
