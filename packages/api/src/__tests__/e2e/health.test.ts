import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import '../../__tests__/helpers/mock-db';
import { createTestApp } from '../helpers/app-factory';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeEach(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  if (app) await app.close();
});

describe('GET /v1/health', () => {
  it('should return 200 with status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });

  it('should include a timestamp', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/health' });
    const body = res.json();
    expect(body.timestamp).toBeDefined();
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it('should not require authentication', async () => {
    // No auth headers — should still work
    const res = await app.inject({ method: 'GET', url: '/v1/health' });
    expect(res.statusCode).toBe(200);
  });
});
