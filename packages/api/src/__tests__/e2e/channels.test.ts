import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mockQuery, resetDbMocks } from '../helpers/mock-db';
import '../../__tests__/helpers/mock-rate-limit';
import { createTestApp, setupAuthMock, authHeaders } from '../helpers/app-factory';
import { makeChannel } from '../helpers/fixtures';
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
});
