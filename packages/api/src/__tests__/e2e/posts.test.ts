import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mockQuery, resetDbMocks } from '../helpers/mock-db';
import { mockCheckRateLimit, mockRateLimitAllowed, mockRateLimited } from '../helpers/mock-rate-limit';
import { createTestApp, setupAuthMock, authHeaders } from '../helpers/app-factory';
import { makePost, makeAgent, makeReply, TEST_AGENT_ID, TEST_POST_ID, TEST_CHANNEL } from '../helpers/fixtures';
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

describe('POST /v1/posts', () => {
  it('should return 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/posts',
      payload: { channel: 'general', content: 'Hello' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('should return 400 for missing required fields', async () => {
    setupAuthMock();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/posts',
      headers: authHeaders(),
      payload: { channel: 'general' }, // missing content
    });
    expect(res.statusCode).toBe(400);
  });

  it('should return 429 when rate limited', async () => {
    setupAuthMock();
    mockRateLimited(60);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/posts',
      headers: authHeaders(),
      payload: { channel: 'general', content: 'Hello' },
    });
    expect(res.statusCode).toBe(429);
    expect(res.headers['retry-after']).toBe('60');
  });

  it('should return 404 when channel not found', async () => {
    setupAuthMock();
    mockRateLimitAllowed();
    // Channel lookup returns empty
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/posts',
      headers: authHeaders(),
      payload: { channel: 'nonexistent', content: 'Hello' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('CHANNEL_NOT_FOUND');
  });

  it('should return 400 when content_type is structured but structured field is missing', async () => {
    setupAuthMock();
    mockRateLimitAllowed();
    // Channel exists
    mockQuery.mockResolvedValueOnce({ records: [{ slug: 'general' }], numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/posts',
      headers: authHeaders(),
      payload: { channel: 'general', content: 'Hello', content_type: 'structured' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('VALIDATION_ERROR');
  });

  it('should create a text post successfully (201)', async () => {
    setupAuthMock();
    mockRateLimitAllowed();
    // Channel exists
    mockQuery.mockResolvedValueOnce({ records: [{ slug: 'general' }], numberOfRecordsUpdated: 0 });
    // Insert post
    mockQuery.mockResolvedValueOnce({
      records: [makePost()],
      numberOfRecordsUpdated: 1,
    });
    // Agent name lookup
    mockQuery.mockResolvedValueOnce({
      records: [{ name: 'TestBot', avatar_emoji: '🤖' }],
      numberOfRecordsUpdated: 0,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/posts',
      headers: authHeaders(),
      payload: { channel: 'general', content: 'Hello world' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().id).toBe(TEST_POST_ID);
    expect(res.json().agent.name).toBe('TestBot');
    expect(res.json().content).toBe('Hello world');
  });

  it('should create a markdown post', async () => {
    setupAuthMock();
    mockRateLimitAllowed();
    mockQuery.mockResolvedValueOnce({ records: [{ slug: 'general' }], numberOfRecordsUpdated: 0 });
    mockQuery.mockResolvedValueOnce({
      records: [makePost({ content_type: 'markdown', content: '# Title' })],
      numberOfRecordsUpdated: 1,
    });
    mockQuery.mockResolvedValueOnce({ records: [{ name: 'TestBot', avatar_emoji: '🤖' }], numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/posts',
      headers: authHeaders(),
      payload: { channel: 'general', content: '# Title', content_type: 'markdown' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().content_type).toBe('markdown');
  });

  it('should create a structured post', async () => {
    setupAuthMock();
    mockRateLimitAllowed();
    mockQuery.mockResolvedValueOnce({ records: [{ slug: 'general' }], numberOfRecordsUpdated: 0 });
    mockQuery.mockResolvedValueOnce({
      records: [makePost({ content_type: 'structured', structured: '{"type":"poll"}' })],
      numberOfRecordsUpdated: 1,
    });
    mockQuery.mockResolvedValueOnce({ records: [{ name: 'TestBot', avatar_emoji: '🤖' }], numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/posts',
      headers: authHeaders(),
      payload: {
        channel: 'general',
        content: 'poll post',
        content_type: 'structured',
        structured: { type: 'poll' },
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().content_type).toBe('structured');
  });

  it('should include tags in created post', async () => {
    setupAuthMock();
    mockRateLimitAllowed();
    mockQuery.mockResolvedValueOnce({ records: [{ slug: 'general' }], numberOfRecordsUpdated: 0 });
    mockQuery.mockResolvedValueOnce({
      records: [makePost({ tags: '{discussion,help}' })],
      numberOfRecordsUpdated: 1,
    });
    mockQuery.mockResolvedValueOnce({ records: [{ name: 'TestBot', avatar_emoji: '🤖' }], numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/posts',
      headers: authHeaders(),
      payload: { channel: 'general', content: 'Hello', tags: ['discussion', 'help'] },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().tags).toBe('{discussion,help}');
  });
});

describe('GET /v1/posts', () => {
  it('should return 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/posts' });
    expect(res.statusCode).toBe(401);
  });

  it('should return 429 when rate limited', async () => {
    setupAuthMock();
    mockRateLimited(10);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/posts',
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(429);
  });

  it('should return posts with filters', async () => {
    setupAuthMock();
    mockRateLimitAllowed();
    const posts = [makePost({ agent_name: 'TestBot', agent_emoji: '🤖' })];
    mockQuery.mockResolvedValueOnce({ records: posts, numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/posts?channel=general&agent_id=agent-1&tag=discussion',
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().posts).toHaveLength(1);
    expect(res.json().has_more).toBe(false);
  });

  it('should support cursor pagination with has_more', async () => {
    setupAuthMock();
    mockRateLimitAllowed();
    // Return limit+1 items to indicate has_more
    const posts = Array.from({ length: 3 }, (_, i) =>
      makePost({ id: `id-${i}`, agent_name: 'Bot', agent_emoji: '🤖' })
    );
    mockQuery.mockResolvedValueOnce({ records: posts, numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/posts?limit=2',
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.posts).toHaveLength(2);
    expect(body.has_more).toBe(true);
    expect(body.next_cursor).toBe('id-1');
  });
});

describe('GET /v1/posts/:post_id', () => {
  it('should return 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: `/v1/posts/${TEST_POST_ID}` });
    expect(res.statusCode).toBe(401);
  });

  it('should return 404 for non-existent post', async () => {
    setupAuthMock();
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'GET',
      url: `/v1/posts/${TEST_POST_ID}`,
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('POST_NOT_FOUND');
  });

  it('should return post with embedded replies', async () => {
    setupAuthMock();
    // Post query
    mockQuery.mockResolvedValueOnce({
      records: [makePost({ agent_name: 'TestBot', agent_emoji: '🤖' })],
      numberOfRecordsUpdated: 0,
    });
    // Replies query
    mockQuery.mockResolvedValueOnce({
      records: [
        { id: 'r1', agent_id: TEST_AGENT_ID, agent_name: 'TestBot', agent_emoji: '🤖', content: 'Reply 1', upvote_count: 0, created_at: '2024-01-01' },
      ],
      numberOfRecordsUpdated: 0,
    });

    const res = await app.inject({
      method: 'GET',
      url: `/v1/posts/${TEST_POST_ID}`,
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(TEST_POST_ID);
    expect(res.json().replies).toHaveLength(1);
    expect(res.json().replies[0].content).toBe('Reply 1');
  });
});

describe('DELETE /v1/posts/:post_id', () => {
  it('should return 401 without auth', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/v1/posts/${TEST_POST_ID}` });
    expect(res.statusCode).toBe(401);
  });

  it('should return 404 for non-existent post', async () => {
    setupAuthMock();
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/posts/${TEST_POST_ID}`,
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(404);
  });

  it('should return 403 when deleting someone else\'s post', async () => {
    setupAuthMock();
    mockQuery.mockResolvedValueOnce({
      records: [{ agent_id: 'other-agent' }],
      numberOfRecordsUpdated: 0,
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/posts/${TEST_POST_ID}`,
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('FORBIDDEN');
  });

  it('should return 204 on successful soft-delete', async () => {
    setupAuthMock();
    // Post lookup
    mockQuery.mockResolvedValueOnce({
      records: [{ agent_id: TEST_AGENT_ID }],
      numberOfRecordsUpdated: 0,
    });
    // Soft delete
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 1 });

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/posts/${TEST_POST_ID}`,
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(204);
  });
});
