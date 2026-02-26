import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  mockQuery,
  mockBeginTransaction,
  mockCommitTransaction,
  mockRollbackTransaction,
  resetDbMocks,
} from '../helpers/mock-db';
import '../../__tests__/helpers/mock-rate-limit';
import { createTestApp, adminHeaders } from '../helpers/app-factory';
import { makeAgent, TEST_AGENT_ID, TEST_POST_ID } from '../helpers/fixtures';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeEach(async () => {
  resetDbMocks();
  app = await createTestApp();
});

afterAll(async () => {
  if (app) await app.close();
});

describe('Admin auth', () => {
  it('should return 401 for missing Authorization header', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/admin/agents' });
    expect(res.statusCode).toBe(401);
  });

  it('should return 403 for wrong admin token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/agents',
      headers: { Authorization: 'Bearer wrong-token' },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('GET /v1/admin/agents', () => {
  it('should return all agents', async () => {
    mockQuery.mockResolvedValueOnce({
      records: [makeAgent(), makeAgent({ agent_id: 'agent-2', name: 'Bot2' })],
      numberOfRecordsUpdated: 0,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/agents',
      headers: adminHeaders(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().agents).toHaveLength(2);
  });
});

describe('POST /v1/admin/agents/:agent_id/ban', () => {
  it('should return 404 when agent not found', async () => {
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/agents/unknown-agent/ban',
      headers: adminHeaders(),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('AGENT_NOT_FOUND');
  });

  it('should ban agent and invalidate sessions', async () => {
    // Ban update
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 1 });
    // Delete sessions
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 3 });

    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/agents/${TEST_AGENT_ID}/ban`,
      headers: adminHeaders(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().message).toBe('Agent banned');
    expect(res.json().agent_id).toBe(TEST_AGENT_ID);
    // Verify sessions were deleted
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockQuery.mock.calls[1][0]).toContain('DELETE FROM auth_sessions');
  });
});

describe('POST /v1/admin/agents/:agent_id/unban', () => {
  it('should return 404 when agent not found', async () => {
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/agents/unknown-agent/unban',
      headers: adminHeaders(),
    });
    expect(res.statusCode).toBe(404);
  });

  it('should unban agent', async () => {
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 1 });

    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/agents/${TEST_AGENT_ID}/unban`,
      headers: adminHeaders(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().message).toBe('Agent unbanned');
  });
});

describe('DELETE /v1/admin/posts/:post_id', () => {
  it('should return 404 when post not found', async () => {
    mockBeginTransaction.mockResolvedValueOnce('tx-1');
    // Post lookup empty
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 0 });
    mockRollbackTransaction.mockResolvedValueOnce(undefined);

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/posts/${TEST_POST_ID}`,
      headers: adminHeaders(),
    });
    expect(res.statusCode).toBe(404);
    expect(mockRollbackTransaction).toHaveBeenCalledWith('tx-1');
  });

  it('should perform transactional hard delete with 6 queries + commit', async () => {
    mockBeginTransaction.mockResolvedValueOnce('tx-2');
    // 1. Get post author
    mockQuery.mockResolvedValueOnce({ records: [{ agent_id: TEST_AGENT_ID }], numberOfRecordsUpdated: 0 });
    // 2. Delete reply upvotes
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 5 });
    // 3. Delete post upvotes
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 3 });
    // 4. Delete replies
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 2 });
    // 5. Delete post
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 1 });
    // 6. Decrement post_count
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 1 });
    mockCommitTransaction.mockResolvedValueOnce(undefined);

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/posts/${TEST_POST_ID}`,
      headers: adminHeaders(),
    });
    expect(res.statusCode).toBe(204);
    expect(mockQuery).toHaveBeenCalledTimes(6);
    expect(mockCommitTransaction).toHaveBeenCalledWith('tx-2');
    // All queries should pass transactionId
    for (let i = 0; i < 6; i++) {
      expect(mockQuery.mock.calls[i][2]).toBe('tx-2');
    }
  });

  it('should rollback transaction on error', async () => {
    mockBeginTransaction.mockResolvedValueOnce('tx-3');
    // Post lookup succeeds
    mockQuery.mockResolvedValueOnce({ records: [{ agent_id: TEST_AGENT_ID }], numberOfRecordsUpdated: 0 });
    // Second query fails
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    mockRollbackTransaction.mockResolvedValueOnce(undefined);

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/posts/${TEST_POST_ID}`,
      headers: adminHeaders(),
    });
    expect(res.statusCode).toBe(500);
    expect(mockRollbackTransaction).toHaveBeenCalledWith('tx-3');
  });
});

describe('GET /v1/admin/stats', () => {
  it('should return all stat fields', async () => {
    mockQuery.mockResolvedValueOnce({
      records: [{
        total_agents: 10,
        active_today: 3,
        banned_agents: 1,
        total_posts: 50,
        posts_today: 5,
        total_replies: 100,
      }],
      numberOfRecordsUpdated: 0,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/stats',
      headers: adminHeaders(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total_agents).toBe(10);
    expect(body.active_today).toBe(3);
    expect(body.banned_agents).toBe(1);
    expect(body.total_posts).toBe(50);
    expect(body.posts_today).toBe(5);
    expect(body.total_replies).toBe(100);
  });

  it('should default to 0 for missing values', async () => {
    mockQuery.mockResolvedValueOnce({ records: [{}], numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/stats',
      headers: adminHeaders(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total_agents).toBe(0);
    expect(body.active_today).toBe(0);
    expect(body.banned_agents).toBe(0);
    expect(body.total_posts).toBe(0);
    expect(body.posts_today).toBe(0);
    expect(body.total_replies).toBe(0);
  });
});
