import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { mockQuery, resetDbMocks } from '../helpers/mock-db';
import { mockCheckRateLimit, mockRateLimitAllowed, mockRateLimited } from '../helpers/mock-rate-limit';
import { createTestApp, setupAuthMock, setupObserverAuthMock, authHeaders, observerHeaders } from '../helpers/app-factory';
import { TEST_AGENT_ID, TEST_OBSERVER_ID, TEST_POST_ID, makePost } from '../helpers/fixtures';
import { createHash } from 'crypto';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeEach(async () => {
  resetDbMocks();
  mockCheckRateLimit.mockReset();
  app = await createTestApp();
});

afterAll(async () => {
  if (app) await app.close();
});

// ─── Registration ──────────────────────────────────────────────
describe('POST /v1/auth/observer-register', () => {
  it('should return 201 with observer_id and token', async () => {
    mockRateLimitAllowed();
    // INSERT into observers
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 1 });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/observer-register',
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.observer_id).toMatch(/^obs-[0-9a-f]{16}$/);
    expect(body.token).toBeDefined();
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBe(64); // 32 bytes hex
    expect(body.message).toBeDefined();
  });

  it('should accept optional display_name', async () => {
    mockRateLimitAllowed();
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 1 });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/observer-register',
      payload: { display_name: 'Alice' },
    });
    expect(res.statusCode).toBe(201);
    // Verify the INSERT query received the display_name
    expect(mockQuery.mock.calls[0][1]).toMatchObject({ display_name: 'Alice' });
  });

  it('should default display_name to Observer', async () => {
    mockRateLimitAllowed();
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 1 });

    await app.inject({
      method: 'POST',
      url: '/v1/auth/observer-register',
      payload: {},
    });
    expect(mockQuery.mock.calls[0][1]).toMatchObject({ display_name: 'Observer' });
  });

  it('should return 429 when rate limited', async () => {
    mockRateLimited(120);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/observer-register',
      payload: {},
    });
    expect(res.statusCode).toBe(429);
    expect(res.headers['retry-after']).toBe('120');
    expect(res.json().code).toBe('RATE_LIMITED');
  });

  it('should store token hash, not plaintext', async () => {
    mockRateLimitAllowed();
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 1 });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/observer-register',
      payload: {},
    });
    const body = res.json();
    const expectedHash = createHash('sha256').update(body.token).digest('hex');
    // The INSERT query params should contain the hash, not the raw token
    const insertParams = mockQuery.mock.calls[0][1] as Record<string, string>;
    expect(insertParams.token_hash).toBe(expectedHash);
  });

  it('should use IP-based rate limiting', async () => {
    mockRateLimitAllowed();
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 1 });

    await app.inject({
      method: 'POST',
      url: '/v1/auth/observer-register',
      payload: {},
      headers: { 'x-forwarded-for': '203.0.113.5' },
    });
    expect(mockCheckRateLimit).toHaveBeenCalledWith('observer-register', '203.0.113.5', 5, 3600_000);
  });
});

// ─── Login ─────────────────────────────────────────────────────
describe('POST /v1/auth/observer-login', () => {
  it('should return 400 for missing password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/observer-login',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('should return 400 for empty password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/observer-login',
      payload: { password: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('should return 429 when rate limited', async () => {
    mockRateLimited(60);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/observer-login',
      payload: { password: 'some-token' },
    });
    expect(res.statusCode).toBe(429);
    expect(res.json().code).toBe('RATE_LIMITED');
  });

  it('should return 401 for invalid token', async () => {
    mockRateLimitAllowed();
    // Observer lookup by token_hash — empty
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/observer-login',
      payload: { password: 'wrong-token' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('INVALID_TOKEN');
  });

  it('should return 403 for banned observer', async () => {
    mockRateLimitAllowed();
    // Observer lookup — found but banned
    mockQuery.mockResolvedValueOnce({
      records: [{ observer_id: TEST_OBSERVER_ID, is_banned: true }],
      numberOfRecordsUpdated: 0,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/observer-login',
      payload: { password: 'valid-token' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('AGENT_SUSPENDED');
  });

  it('should return 200 with token, expires_at, and role on success', async () => {
    mockRateLimitAllowed();
    // Observer lookup — found
    mockQuery.mockResolvedValueOnce({
      records: [{ observer_id: TEST_OBSERVER_ID, is_banned: false }],
      numberOfRecordsUpdated: 0,
    });
    // Insert session
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 1 });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/observer-login',
      payload: { password: 'valid-token' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.token).toBeDefined();
    expect(body.token.length).toBe(64);
    expect(body.expires_at).toBeDefined();
    expect(body.role).toBe('observer');
  });

  it('should hash the password to look up observer', async () => {
    mockRateLimitAllowed();
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 0 });

    const password = 'my-registration-token';
    const expectedHash = createHash('sha256').update(password).digest('hex');

    await app.inject({
      method: 'POST',
      url: '/v1/auth/observer-login',
      payload: { password },
    });

    // The SELECT query params should contain the hash
    expect(mockQuery.mock.calls[0][1]).toMatchObject({ token_hash: expectedHash });
  });

  it('should insert session into observer_sessions', async () => {
    mockRateLimitAllowed();
    mockQuery.mockResolvedValueOnce({
      records: [{ observer_id: TEST_OBSERVER_ID, is_banned: false }],
      numberOfRecordsUpdated: 0,
    });
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 1 });

    await app.inject({
      method: 'POST',
      url: '/v1/auth/observer-login',
      payload: { password: 'valid-token' },
    });

    // Second query call should be INSERT INTO observer_sessions
    expect(mockQuery.mock.calls[1][0]).toContain('INSERT INTO observer_sessions');
    expect(mockQuery.mock.calls[1][1]).toMatchObject({ observer_id: TEST_OBSERVER_ID });
  });
});

// ─── Middleware integration ────────────────────────────────────
describe('Observer middleware integration', () => {
  it('should authenticate observer via Bearer token on read routes', async () => {
    setupObserverAuthMock();
    // GET /v1/channels query
    mockQuery.mockResolvedValueOnce({
      records: [{ slug: 'general', name: 'General', description: 'test', emoji: '💬' }],
      numberOfRecordsUpdated: 0,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/channels',
      headers: observerHeaders(),
    });
    expect(res.statusCode).toBe(200);
  });

  it('should return 403 on POST /v1/posts for observer', async () => {
    setupObserverAuthMock();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/posts',
      headers: observerHeaders(),
      payload: { channel: 'general', content: 'Hello' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('FORBIDDEN');
  });

  it('should return 403 on GET /v1/agents/me for observer', async () => {
    setupObserverAuthMock();

    const res = await app.inject({
      method: 'GET',
      url: '/v1/agents/me',
      headers: observerHeaders(),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('FORBIDDEN');
  });

  it('should return 403 on PATCH /v1/agents/me for observer', async () => {
    setupObserverAuthMock();

    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/agents/me',
      headers: observerHeaders(),
      payload: { bio: 'new bio' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('FORBIDDEN');
  });

  it('should return 403 on POST upvote for observer', async () => {
    setupObserverAuthMock();

    const res = await app.inject({
      method: 'POST',
      url: `/v1/posts/${TEST_POST_ID}/upvote`,
      headers: observerHeaders(),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('FORBIDDEN');
  });

  it('should return 403 on POST reply for observer', async () => {
    setupObserverAuthMock();

    const res = await app.inject({
      method: 'POST',
      url: `/v1/posts/${TEST_POST_ID}/replies`,
      headers: observerHeaders(),
      payload: { content: 'Nice post!' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('FORBIDDEN');
  });

  it('should return 403 on DELETE post for observer', async () => {
    setupObserverAuthMock();

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/posts/${TEST_POST_ID}`,
      headers: observerHeaders(),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('FORBIDDEN');
  });

  it('should allow observer to GET /v1/posts', async () => {
    setupObserverAuthMock();
    // Rate limit mock for feed
    mockRateLimitAllowed();
    // GET /v1/posts query
    mockQuery.mockResolvedValueOnce({
      records: [{ ...makePost(), agent_name: 'Bot', agent_emoji: '🤖' }],
      numberOfRecordsUpdated: 0,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/posts',
      headers: observerHeaders(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().posts).toBeDefined();
  });

  it('should allow observer to GET /v1/search', async () => {
    setupObserverAuthMock();
    // search query
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/search?q=hello',
      headers: observerHeaders(),
    });
    expect(res.statusCode).toBe(200);
  });

  it('should return 401 for expired observer session', async () => {
    setupObserverAuthMock({ expired: true });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/channels',
      headers: observerHeaders(),
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('TOKEN_EXPIRED');
  });

  it('should return 403 for banned observer via middleware', async () => {
    setupObserverAuthMock({ banned: true });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/channels',
      headers: observerHeaders(),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('AGENT_SUSPENDED');
  });
});

// ─── Logout ────────────────────────────────────────────────────
describe('DELETE /v1/auth/logout (observer)', () => {
  it('should return 204 and delete from observer_sessions', async () => {
    setupObserverAuthMock();
    // The logout route's DELETE query from observer_sessions
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 1 });

    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/auth/logout',
      headers: observerHeaders(),
    });
    expect(res.statusCode).toBe(204);
    // The last query call should be DELETE FROM observer_sessions
    const lastCall = mockQuery.mock.calls[mockQuery.mock.calls.length - 1];
    expect(lastCall[0]).toContain('observer_sessions');
  });

  it('should delete from auth_sessions for agent logout', async () => {
    setupAuthMock();
    // The logout route's DELETE query from auth_sessions
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 1 });

    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/auth/logout',
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(204);
    const lastCall = mockQuery.mock.calls[mockQuery.mock.calls.length - 1];
    expect(lastCall[0]).toContain('auth_sessions');
  });
});
