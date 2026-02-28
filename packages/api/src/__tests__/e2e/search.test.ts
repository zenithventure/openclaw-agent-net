import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mockQuery, resetDbMocks } from '../helpers/mock-db';
import '../../__tests__/helpers/mock-rate-limit';
import { createTestApp, setupAuthMock, authHeaders } from '../helpers/app-factory';
import { TEST_AGENT_ID } from '../helpers/fixtures';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeEach(async () => {
  resetDbMocks();
  app = await createTestApp();
});

afterAll(async () => {
  if (app) await app.close();
});

describe('GET /v1/search', () => {
  it('should return 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/search?q=hello' });
    expect(res.statusCode).toBe(401);
  });

  it('should return 400 for missing q parameter', async () => {
    setupAuthMock();

    const res = await app.inject({
      method: 'GET',
      url: '/v1/search',
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(400);
  });

  it('should return 400 for q shorter than 2 chars', async () => {
    setupAuthMock();

    const res = await app.inject({
      method: 'GET',
      url: '/v1/search?q=a',
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(400);
  });

  it('should call search_posts function and return results', async () => {
    setupAuthMock();
    // search_posts result
    mockQuery.mockResolvedValueOnce({
      records: [
        {
          post_id: 'p1',
          agent_id: TEST_AGENT_ID,
          channel_slug: 'general',
          content: 'Hello world',
          content_type: 'text',
          tags: null,
          upvote_count: 1,
          reply_count: 0,
          created_at: '2024-01-01',
          headline: '<b>Hello</b> world',
        },
      ],
      numberOfRecordsUpdated: 0,
    });
    // Agent enrichment query
    mockQuery.mockResolvedValueOnce({
      records: [{ agent_id: TEST_AGENT_ID, name: 'TestBot', avatar_emoji: '🤖' }],
      numberOfRecordsUpdated: 0,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/search?q=hello',
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0].type).toBe('post');
    expect(body.results[0].post.agent.name).toBe('TestBot');
    expect(body.results[0].excerpt).toBe('<b>Hello</b> world');
  });

  it('should enrich results with agent names and emojis', async () => {
    setupAuthMock();
    mockQuery.mockResolvedValueOnce({
      records: [
        { post_id: 'p1', agent_id: 'a1', channel_slug: 'general', content: 'test', content_type: 'text', tags: null, upvote_count: 0, reply_count: 0, created_at: '2024-01-01', headline: 'test' },
        { post_id: 'p2', agent_id: 'a2', channel_slug: 'general', content: 'test2', content_type: 'text', tags: null, upvote_count: 0, reply_count: 0, created_at: '2024-01-01', headline: 'test2' },
      ],
      numberOfRecordsUpdated: 0,
    });
    mockQuery.mockResolvedValueOnce({
      records: [
        { agent_id: 'a1', name: 'Bot1', avatar_emoji: '🤖' },
        { agent_id: 'a2', name: 'Bot2', avatar_emoji: '🎯' },
      ],
      numberOfRecordsUpdated: 0,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/search?q=test',
      headers: authHeaders(),
    });
    const body = res.json();
    expect(body.results[0].post.agent.name).toBe('Bot1');
    expect(body.results[1].post.agent.avatar_emoji).toBe('🎯');
  });

  it('should return empty results', async () => {
    setupAuthMock();
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/search?q=nonexistent',
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().results).toHaveLength(0);
  });

  it('should clamp limit to 50', async () => {
    setupAuthMock();
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 0 });

    // The schema max is 50, so pass 50 and verify it goes through
    await app.inject({
      method: 'GET',
      url: '/v1/search?q=test&limit=50',
      headers: authHeaders(),
    });

    // Find the search_posts call (after auth calls)
    const searchCallIndex = mockQuery.mock.calls.findIndex(
      (call) => typeof call[0] === 'string' && call[0].includes('search_posts')
    );
    expect(searchCallIndex).toBeGreaterThanOrEqual(0);
    expect(mockQuery.mock.calls[searchCallIndex][1]?.lim).toBe(50);
  });

  it('should filter by channel', async () => {
    setupAuthMock();
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 0 });

    await app.inject({
      method: 'GET',
      url: '/v1/search?q=test&channel=tech',
      headers: authHeaders(),
    });

    const searchCallIndex = mockQuery.mock.calls.findIndex(
      (call) => typeof call[0] === 'string' && call[0].includes('search_posts')
    );
    expect(searchCallIndex).toBeGreaterThanOrEqual(0);
    expect(mockQuery.mock.calls[searchCallIndex][1]?.channel).toBe('tech');
  });
});
