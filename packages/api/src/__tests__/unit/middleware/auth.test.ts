import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { mockQuery, resetDbMocks } from '../../helpers/mock-db';
import { createTestApp, authHeaders } from '../../helpers/app-factory';
import { makeSession, TEST_AGENT_ID } from '../../helpers/fixtures';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeEach(async () => {
  resetDbMocks();
  app = await createTestApp();
});

afterAll(async () => {
  if (app) await app.close();
});

describe('Auth middleware', () => {
  describe('public endpoint bypass', () => {
    it('should skip auth for /v1/health', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/health' });
      expect(res.statusCode).toBe(200);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should skip auth for /v1/auth/login', async () => {
      // Login needs rate-limit and fetch mocks, but the auth middleware itself
      // should not call query. We'll get a 400 for missing body, which is fine.
      const res = await app.inject({ method: 'POST', url: '/v1/auth/login' });
      // Will fail validation, but auth middleware was skipped
      expect(res.statusCode).toBe(400);
    });
  });

  describe('agent auth', () => {
    it('should return 401 for missing Authorization header', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/agents/me' });
      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe('UNAUTHORIZED');
    });

    it('should return 401 for malformed Authorization header (no Bearer)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/agents/me',
        headers: { Authorization: 'Basic abc123' },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe('UNAUTHORIZED');
    });

    it('should return 401 for session not found', async () => {
      mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 0 });

      const res = await app.inject({
        method: 'GET',
        url: '/v1/agents/me',
        headers: authHeaders('bad-token'),
      });
      expect(res.statusCode).toBe(401);
    });

    it('should return 401 and delete expired session', async () => {
      // Session lookup returns expired session
      mockQuery.mockResolvedValueOnce({
        records: [{ agent_id: TEST_AGENT_ID, expires_at: '2020-01-01T00:00:00.000Z' }],
        numberOfRecordsUpdated: 0,
      });
      // DELETE expired session
      mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 1 });

      const res = await app.inject({
        method: 'GET',
        url: '/v1/agents/me',
        headers: authHeaders(),
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe('TOKEN_EXPIRED');
      // Verify DELETE was called (2nd query call)
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('should return 403 for banned agent', async () => {
      // Session lookup
      mockQuery.mockResolvedValueOnce({
        records: [makeSession()],
        numberOfRecordsUpdated: 0,
      });
      // Ban check - agent is banned
      mockQuery.mockResolvedValueOnce({
        records: [{ is_banned: true }],
        numberOfRecordsUpdated: 0,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/v1/agents/me',
        headers: authHeaders(),
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe('AGENT_SUSPENDED');
    });

    it('should populate request.auth on successful auth', async () => {
      // Session lookup
      mockQuery.mockResolvedValueOnce({
        records: [makeSession()],
        numberOfRecordsUpdated: 0,
      });
      // Ban check
      mockQuery.mockResolvedValueOnce({
        records: [{ is_banned: false }],
        numberOfRecordsUpdated: 0,
      });
      // Update last_active
      mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 1 });
      // The route handler query (GET /v1/agents/me)
      mockQuery.mockResolvedValueOnce({
        records: [{ agent_id: TEST_AGENT_ID, name: 'Test' }],
        numberOfRecordsUpdated: 0,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/v1/agents/me',
        headers: authHeaders(),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().agent_id).toBe(TEST_AGENT_ID);
    });
  });

  describe('admin auth', () => {
    it('should return 500 when ADMIN_SECRET env is not set', async () => {
      const original = process.env.ADMIN_SECRET;
      delete process.env.ADMIN_SECRET;

      const res = await app.inject({
        method: 'GET',
        url: '/v1/admin/agents',
        headers: { Authorization: 'Bearer some-token' },
      });
      expect(res.statusCode).toBe(500);
      expect(res.json().code).toBe('INTERNAL_ERROR');

      process.env.ADMIN_SECRET = original;
    });

    it('should return 401 for missing Authorization header on admin endpoint', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/admin/agents' });
      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe('UNAUTHORIZED');
    });

    it('should return 403 for wrong admin token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/admin/agents',
        headers: { Authorization: 'Bearer wrong-token' },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe('FORBIDDEN');
    });

    it('should pass with correct admin token', async () => {
      // Admin auth passes, then the route handler calls query
      mockQuery.mockResolvedValueOnce({
        records: [{ agent_id: 'a1', name: 'Bot' }],
        numberOfRecordsUpdated: 0,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/v1/admin/agents',
        headers: { Authorization: `Bearer ${process.env.ADMIN_SECRET}` },
      });
      expect(res.statusCode).toBe(200);
    });
  });
});
