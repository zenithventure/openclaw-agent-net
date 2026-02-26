import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mockQuery, resetDbMocks } from '../helpers/mock-db';
import { mockCheckRateLimit, mockRateLimitAllowed, mockRateLimited } from '../helpers/mock-rate-limit';
import { createTestApp, setupAuthMock, authHeaders } from '../helpers/app-factory';
import { makeReply, TEST_AGENT_ID, TEST_POST_ID, TEST_REPLY_ID } from '../helpers/fixtures';
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

describe('POST /v1/posts/:post_id/replies', () => {
  it('should return 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/posts/${TEST_POST_ID}/replies`,
      payload: { content: 'A reply' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('should return 400 for missing content', async () => {
    setupAuthMock();

    const res = await app.inject({
      method: 'POST',
      url: `/v1/posts/${TEST_POST_ID}/replies`,
      headers: authHeaders(),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('should return 429 when rate limited', async () => {
    setupAuthMock();
    mockRateLimited(20);

    const res = await app.inject({
      method: 'POST',
      url: `/v1/posts/${TEST_POST_ID}/replies`,
      headers: authHeaders(),
      payload: { content: 'A reply' },
    });
    expect(res.statusCode).toBe(429);
  });

  it('should return 404 when parent post not found', async () => {
    setupAuthMock();
    mockRateLimitAllowed();
    // Post lookup returns empty
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'POST',
      url: `/v1/posts/${TEST_POST_ID}/replies`,
      headers: authHeaders(),
      payload: { content: 'A reply' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('POST_NOT_FOUND');
  });

  it('should return 201 on successful reply creation', async () => {
    setupAuthMock();
    mockRateLimitAllowed();
    // Post exists
    mockQuery.mockResolvedValueOnce({ records: [{ id: TEST_POST_ID }], numberOfRecordsUpdated: 0 });
    // Insert reply
    mockQuery.mockResolvedValueOnce({
      records: [makeReply()],
      numberOfRecordsUpdated: 1,
    });
    // Agent name
    mockQuery.mockResolvedValueOnce({
      records: [{ name: 'TestBot', avatar_emoji: '🤖' }],
      numberOfRecordsUpdated: 0,
    });

    const res = await app.inject({
      method: 'POST',
      url: `/v1/posts/${TEST_POST_ID}/replies`,
      headers: authHeaders(),
      payload: { content: 'Nice post!' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().id).toBe(TEST_REPLY_ID);
    expect(res.json().agent_name).toBe('TestBot');
    expect(res.json().content).toBe('Nice post!');
  });
});

describe('DELETE /v1/posts/:post_id/replies/:reply_id', () => {
  it('should return 401 without auth', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/posts/${TEST_POST_ID}/replies/${TEST_REPLY_ID}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('should return 404 when reply not found', async () => {
    setupAuthMock();
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/posts/${TEST_POST_ID}/replies/${TEST_REPLY_ID}`,
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('REPLY_NOT_FOUND');
  });

  it('should return 404 when reply does not belong to post', async () => {
    setupAuthMock();
    mockQuery.mockResolvedValueOnce({
      records: [{ agent_id: TEST_AGENT_ID, post_id: 'other-post-id' }],
      numberOfRecordsUpdated: 0,
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/posts/${TEST_POST_ID}/replies/${TEST_REPLY_ID}`,
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('REPLY_NOT_FOUND');
  });

  it('should return 403 when deleting someone else\'s reply', async () => {
    setupAuthMock();
    mockQuery.mockResolvedValueOnce({
      records: [{ agent_id: 'other-agent', post_id: TEST_POST_ID }],
      numberOfRecordsUpdated: 0,
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/posts/${TEST_POST_ID}/replies/${TEST_REPLY_ID}`,
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('FORBIDDEN');
  });

  it('should return 204 on successful soft-delete', async () => {
    setupAuthMock();
    // Reply lookup
    mockQuery.mockResolvedValueOnce({
      records: [{ agent_id: TEST_AGENT_ID, post_id: TEST_POST_ID }],
      numberOfRecordsUpdated: 0,
    });
    // Soft delete
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 1 });

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/posts/${TEST_POST_ID}/replies/${TEST_REPLY_ID}`,
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(204);
  });
});
