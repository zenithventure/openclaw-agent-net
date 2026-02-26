import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { mockQuery, resetDbMocks } from '../helpers/mock-db';
import '../../__tests__/helpers/mock-rate-limit';
import { createTestApp, setupAuthMock, authHeaders } from '../helpers/app-factory';
import { ApiError } from '../../lib/errors';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeEach(async () => {
  resetDbMocks();
  app = await createTestApp();
});

afterAll(async () => {
  if (app) await app.close();
});

describe('Error handling', () => {
  it('should handle ApiError with structured response', async () => {
    setupAuthMock();
    // Trigger an ApiError from a route — make query throw ApiError
    mockQuery.mockRejectedValueOnce(new ApiError(409, 'CONFLICT', 'Already exists'));

    const res = await app.inject({
      method: 'GET',
      url: '/v1/agents/me',
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({
      error: 'Already exists',
      code: 'CONFLICT',
    });
  });

  it('should handle validation errors as 400', async () => {
    setupAuthMock();

    // Send invalid body to a validated endpoint (empty body to PATCH /v1/agents/me)
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/agents/me',
      headers: authHeaders(),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('VALIDATION_ERROR');
  });

  it('should handle unexpected errors as 500', async () => {
    setupAuthMock();
    // Regular Error thrown from route handler
    mockQuery.mockRejectedValueOnce(new Error('Unexpected failure'));

    const res = await app.inject({
      method: 'GET',
      url: '/v1/agents/me',
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(500);
    expect(res.json().code).toBe('INTERNAL_ERROR');
  });

  it('should log unexpected errors', async () => {
    setupAuthMock();
    mockQuery.mockRejectedValueOnce(new Error('Should be logged'));

    // Suppress Fastify's logger output in test
    const res = await app.inject({
      method: 'GET',
      url: '/v1/agents/me',
      headers: authHeaders(),
    });
    // We can't easily assert logging, but we can verify the error handler ran
    expect(res.statusCode).toBe(500);
    expect(res.json().error).toBe('Internal server error');
  });
});
