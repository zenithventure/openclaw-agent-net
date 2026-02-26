import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mockQuery, resetDbMocks } from '../helpers/mock-db';
import { mockCheckRateLimit, mockRateLimitAllowed, mockRateLimited } from '../helpers/mock-rate-limit';
import { createTestApp, setupAuthMock, authHeaders } from '../helpers/app-factory';
import { TEST_AGENT_ID, TEST_POST_ID, TEST_REPLY_ID } from '../helpers/fixtures';
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

describe('POST /v1/posts/:post_id/upvote', () => {
  it('should return 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/posts/${TEST_POST_ID}/upvote`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('should return 429 when rate limited', async () => {
    setupAuthMock();
    mockRateLimited(30);

    const res = await app.inject({
      method: 'POST',
      url: `/v1/posts/${TEST_POST_ID}/upvote`,
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(429);
  });

  it('should return 404 when post not found', async () => {
    setupAuthMock();
    mockRateLimitAllowed();
    // Post lookup returns empty
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'POST',
      url: `/v1/posts/${TEST_POST_ID}/upvote`,
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('POST_NOT_FOUND');
  });

  it('should upvote and return upvote_count', async () => {
    setupAuthMock();
    mockRateLimitAllowed();
    // Post exists
    mockQuery.mockResolvedValueOnce({ records: [{ id: TEST_POST_ID }], numberOfRecordsUpdated: 0 });
    // Insert upvote
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 1 });
    // Count query
    mockQuery.mockResolvedValueOnce({ records: [{ upvote_count: 5 }], numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'POST',
      url: `/v1/posts/${TEST_POST_ID}/upvote`,
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().upvote_count).toBe(5);
  });
});

describe('DELETE /v1/posts/:post_id/upvote', () => {
  it('should return 401 without auth', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/posts/${TEST_POST_ID}/upvote`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('should remove upvote and return updated count', async () => {
    setupAuthMock();
    // Delete upvote
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 1 });
    // Count query
    mockQuery.mockResolvedValueOnce({ records: [{ upvote_count: 2 }], numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/posts/${TEST_POST_ID}/upvote`,
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().upvote_count).toBe(2);
  });
});

describe('POST /v1/posts/:post_id/replies/:reply_id/upvote', () => {
  it('should return 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/posts/${TEST_POST_ID}/replies/${TEST_REPLY_ID}/upvote`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('should return 429 when rate limited', async () => {
    setupAuthMock();
    mockRateLimited(15);

    const res = await app.inject({
      method: 'POST',
      url: `/v1/posts/${TEST_POST_ID}/replies/${TEST_REPLY_ID}/upvote`,
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(429);
  });

  it('should return 404 when reply not found', async () => {
    setupAuthMock();
    mockRateLimitAllowed();
    // Reply lookup empty
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'POST',
      url: `/v1/posts/${TEST_POST_ID}/replies/${TEST_REPLY_ID}/upvote`,
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('REPLY_NOT_FOUND');
  });

  it('should upvote reply and return count', async () => {
    setupAuthMock();
    mockRateLimitAllowed();
    // Reply exists
    mockQuery.mockResolvedValueOnce({ records: [{ id: TEST_REPLY_ID }], numberOfRecordsUpdated: 0 });
    // Insert upvote
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 1 });
    // Count query
    mockQuery.mockResolvedValueOnce({ records: [{ upvote_count: 3 }], numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'POST',
      url: `/v1/posts/${TEST_POST_ID}/replies/${TEST_REPLY_ID}/upvote`,
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().upvote_count).toBe(3);
  });
});

describe('DELETE /v1/posts/:post_id/replies/:reply_id/upvote', () => {
  it('should return 401 without auth', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/posts/${TEST_POST_ID}/replies/${TEST_REPLY_ID}/upvote`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('should remove reply upvote and return count', async () => {
    setupAuthMock();
    // Delete upvote
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 1 });
    // Count query
    mockQuery.mockResolvedValueOnce({ records: [{ upvote_count: 0 }], numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/posts/${TEST_POST_ID}/replies/${TEST_REPLY_ID}/upvote`,
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().upvote_count).toBe(0);
  });
});
