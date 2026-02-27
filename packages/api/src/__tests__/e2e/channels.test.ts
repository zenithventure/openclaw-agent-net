import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mockQuery, resetDbMocks } from '../helpers/mock-db';
import { mockCheckRateLimit, mockRateLimitAllowed, mockRateLimited } from '../helpers/mock-rate-limit';
import { createTestApp, setupAuthMock, setupObserverAuthMock, authHeaders, observerHeaders } from '../helpers/app-factory';
import { TEST_AGENT_ID, makeChannel } from '../helpers/fixtures';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeEach(async () => {
  resetDbMocks();
  app = await createTestApp();
});

afterAll(async () => {
  if (app) await app.close();
});

describe('GET /v1/channels', () => {
  it('should return 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/channels' });
    expect(res.statusCode).toBe(401);
  });

  it('should return channel list', async () => {
    setupAuthMock();
    const channels = [
      makeChannel(),
      makeChannel({ slug: 'tech', name: 'Technology', emoji: '💻' }),
    ];
    mockQuery.mockResolvedValueOnce({ records: channels, numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/channels',
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().channels).toHaveLength(2);
    expect(res.json().channels[0].slug).toBe('general');
  });

  it('should include Cache-Control header', async () => {
    setupAuthMock();
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/channels',
      headers: authHeaders(),
    });
    expect(res.headers['cache-control']).toBe('public, max-age=3600');
  });

  it('should include created_by field', async () => {
    setupAuthMock();
    mockQuery.mockResolvedValueOnce({
      records: [
        makeChannel({ created_by: null }),
        makeChannel({ slug: 'backup', name: 'Backup', created_by: 'agent-backup-001' }),
      ],
      numberOfRecordsUpdated: 0,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/channels',
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().channels[0].created_by).toBeNull();
    expect(res.json().channels[1].created_by).toBe('agent-backup-001');
  });
});

// ─── Channel Creation ──────────────────────────────────────────
describe('POST /v1/channels', () => {
  it('should create a channel (201)', async () => {
    setupAuthMock();
    mockRateLimitAllowed();
    // Slug uniqueness check
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 0 });
    // INSERT
    mockQuery.mockResolvedValueOnce({
      records: [makeChannel({
        slug: 'defi-support',
        name: '#defi-support',
        description: 'DeFi agent support',
        emoji: '💰',
        created_by: TEST_AGENT_ID,
      })],
      numberOfRecordsUpdated: 1,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/channels',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      payload: {
        slug: 'defi-support',
        name: '#defi-support',
        description: 'DeFi agent support',
        emoji: '💰',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.channel.slug).toBe('defi-support');
    expect(body.channel.created_by).toBe(TEST_AGENT_ID);
  });

  it('should reject duplicate slug (409)', async () => {
    setupAuthMock();
    mockRateLimitAllowed();
    mockQuery.mockResolvedValueOnce({
      records: [{ slug: 'backup' }],
      numberOfRecordsUpdated: 0,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/channels',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      payload: { slug: 'backup', name: '#backup' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('CHANNEL_ALREADY_EXISTS');
  });

  it('should enforce rate limit (429)', async () => {
    setupAuthMock();
    mockRateLimited(30);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/channels',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      payload: { slug: 'new-channel', name: '#new-channel' },
    });
    expect(res.statusCode).toBe(429);
  });

  it('should reject invalid slug format (400)', async () => {
    setupAuthMock();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/channels',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      payload: { slug: 'Invalid Slug!', name: 'Bad' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('should reject missing name (400)', async () => {
    setupAuthMock();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/channels',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      payload: { slug: 'valid-slug' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('should reject observer (403)', async () => {
    setupObserverAuthMock();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/channels',
      headers: { ...observerHeaders(), 'Content-Type': 'application/json' },
      payload: { slug: 'observer-channel', name: '#observer-channel' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('should create channel without optional fields', async () => {
    setupAuthMock();
    mockRateLimitAllowed();
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 0 });
    mockQuery.mockResolvedValueOnce({
      records: [makeChannel({
        slug: 'minimal',
        name: '#minimal',
        description: null,
        emoji: null,
        created_by: TEST_AGENT_ID,
      })],
      numberOfRecordsUpdated: 1,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/channels',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      payload: { slug: 'minimal', name: '#minimal' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().channel.description).toBeNull();
    expect(res.json().channel.emoji).toBeNull();
  });
});
