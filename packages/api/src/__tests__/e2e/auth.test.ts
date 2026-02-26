import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { mockQuery, resetDbMocks } from '../helpers/mock-db';
import { mockCheckRateLimit, mockRateLimitAllowed, mockRateLimited } from '../helpers/mock-rate-limit';
import { setupFetchMock, mockFetchResponse, mockFetchError, mockFetch, resetFetchMocks } from '../helpers/mock-fetch';
import { createTestApp, setupAuthMock, authHeaders } from '../helpers/app-factory';
import { TEST_AGENT_ID } from '../helpers/fixtures';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

setupFetchMock();

beforeEach(async () => {
  resetDbMocks();
  resetFetchMocks();
  mockCheckRateLimit.mockReset();
  app = await createTestApp();
});

afterAll(async () => {
  if (app) await app.close();
});

describe('POST /v1/auth/login', () => {
  it('should return 400 for missing backup_token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('should return 400 for empty backup_token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { backup_token: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('should return 429 when rate limited', async () => {
    mockRateLimited(45);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { backup_token: 'valid-token' },
    });
    expect(res.statusCode).toBe(429);
    expect(res.headers['retry-after']).toBe('45');
    expect(res.json().code).toBe('RATE_LIMITED');
  });

  it('should call backup API with correct URL and headers', async () => {
    mockRateLimitAllowed();
    mockFetchResponse({ agent_id: TEST_AGENT_ID, name: 'Bot' });
    // upsert
    mockQuery.mockResolvedValueOnce({
      records: [{ agent_id: TEST_AGENT_ID, name: 'Bot', joined_at: '2024-01-01', is_banned: false }],
      numberOfRecordsUpdated: 1,
    });
    // insert session
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 1 });

    await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { backup_token: 'my-backup-token' },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      `${process.env.BACKUP_API_URL}/v1/agents/me`,
      expect.objectContaining({
        headers: { Authorization: 'Bearer my-backup-token' },
      })
    );
  });

  it('should return 401 when backup API returns 401', async () => {
    mockRateLimitAllowed();
    mockFetchResponse({}, 401);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { backup_token: 'bad-token' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('INVALID_TOKEN');
  });

  it('should return 401 when backup API returns 403', async () => {
    mockRateLimitAllowed();
    mockFetchResponse({}, 403);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { backup_token: 'forbidden-token' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('INVALID_TOKEN');
  });

  it('should return 503 when backup API returns other error', async () => {
    mockRateLimitAllowed();
    mockFetchResponse({}, 500);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { backup_token: 'valid-token' },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().code).toBe('BACKUP_SERVICE_UNAVAILABLE');
  });

  it('should return 503 when backup API is unreachable', async () => {
    mockRateLimitAllowed();
    mockFetchError('Network error');

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { backup_token: 'valid-token' },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().code).toBe('BACKUP_SERVICE_UNAVAILABLE');
  });

  it('should return 403 when agent status is not active on backup', async () => {
    mockRateLimitAllowed();
    mockFetchResponse({ agent_id: TEST_AGENT_ID, name: 'Bot', status: 'suspended' });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { backup_token: 'valid-token' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('AGENT_SUSPENDED');
  });

  it('should return 403 when agent is banned locally', async () => {
    mockRateLimitAllowed();
    mockFetchResponse({ agent_id: TEST_AGENT_ID, name: 'Bot' });
    // upsert returns banned agent
    mockQuery.mockResolvedValueOnce({
      records: [{ agent_id: TEST_AGENT_ID, name: 'Bot', joined_at: '2024-01-01', is_banned: true }],
      numberOfRecordsUpdated: 1,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { backup_token: 'valid-token' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('AGENT_SUSPENDED');
  });

  it('should upsert agent and create session on success', async () => {
    mockRateLimitAllowed();
    mockFetchResponse({ agent_id: TEST_AGENT_ID, name: 'Bot' });
    // upsert
    mockQuery.mockResolvedValueOnce({
      records: [{ agent_id: TEST_AGENT_ID, name: 'Bot', joined_at: '2024-01-01T00:00:00Z', is_banned: false }],
      numberOfRecordsUpdated: 1,
    });
    // insert session
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 1 });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { backup_token: 'valid-token' },
    });
    expect(res.statusCode).toBe(200);
    expect(mockQuery).toHaveBeenCalledTimes(2);
    // First call: upsert agent
    expect(mockQuery.mock.calls[0][0]).toContain('INSERT INTO agents');
    // Second call: insert session
    expect(mockQuery.mock.calls[1][0]).toContain('INSERT INTO auth_sessions');
  });

  it('should return token, expires_at, and agent on success', async () => {
    mockRateLimitAllowed();
    mockFetchResponse({ agent_id: TEST_AGENT_ID, name: 'Bot' });
    mockQuery.mockResolvedValueOnce({
      records: [{ agent_id: TEST_AGENT_ID, name: 'Bot', joined_at: '2024-01-01T00:00:00Z', is_banned: false }],
      numberOfRecordsUpdated: 1,
    });
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 1 });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { backup_token: 'valid-token' },
    });
    const body = res.json();
    expect(body.token).toBeDefined();
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBe(64); // 32 bytes = 64 hex chars
    expect(body.expires_at).toBeDefined();
    expect(body.agent).toEqual({
      id: TEST_AGENT_ID,
      name: 'Bot',
      joined_at: '2024-01-01T00:00:00Z',
    });
  });

  it('should use x-forwarded-for IP for rate limiting', async () => {
    mockRateLimitAllowed();
    mockFetchResponse({ agent_id: TEST_AGENT_ID, name: 'Bot' });
    mockQuery.mockResolvedValueOnce({
      records: [{ agent_id: TEST_AGENT_ID, name: 'Bot', joined_at: '2024-01-01', is_banned: false }],
      numberOfRecordsUpdated: 1,
    });
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 1 });

    await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { backup_token: 'valid-token' },
      headers: { 'x-forwarded-for': '10.0.0.1, 192.168.1.1' },
    });

    expect(mockCheckRateLimit).toHaveBeenCalledWith('login', '10.0.0.1', 10, 3600_000);
  });
});

describe('DELETE /v1/auth/logout', () => {
  it('should return 401 without auth', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/auth/logout',
    });
    expect(res.statusCode).toBe(401);
  });

  it('should return 204 on successful logout', async () => {
    setupAuthMock();
    // The logout route's DELETE query
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 1 });

    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/auth/logout',
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(204);
  });
});
