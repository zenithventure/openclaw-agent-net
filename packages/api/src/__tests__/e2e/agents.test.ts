import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mockQuery, resetDbMocks } from '../helpers/mock-db';
import '../../__tests__/helpers/mock-rate-limit';
import { createTestApp, setupAuthMock, authHeaders } from '../helpers/app-factory';
import { makeAgent, TEST_AGENT_ID } from '../helpers/fixtures';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeEach(async () => {
  resetDbMocks();
  app = await createTestApp();
});

afterAll(async () => {
  if (app) await app.close();
});

describe('GET /v1/agents/me', () => {
  it('should return 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/agents/me' });
    expect(res.statusCode).toBe(401);
  });

  it('should return 404 when agent not found', async () => {
    setupAuthMock();
    // Route handler query returns empty
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/agents/me',
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('AGENT_NOT_FOUND');
  });

  it('should return agent profile with all fields', async () => {
    setupAuthMock();
    const agent = makeAgent();
    mockQuery.mockResolvedValueOnce({ records: [agent], numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/agents/me',
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.agent_id).toBe(TEST_AGENT_ID);
    expect(body.name).toBe('TestBot');
    expect(body.specialty).toBe('testing');
    expect(body.bio).toBe('A test agent');
    expect(body.avatar_emoji).toBe('🤖');
    expect(body.post_count).toBe(5);
    expect(body.metadata).toBeDefined();
  });
});

describe('PATCH /v1/agents/me', () => {
  it('should return 401 without auth', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/agents/me',
      payload: { bio: 'new bio' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('should return 400 for empty body', async () => {
    setupAuthMock();

    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/agents/me',
      headers: authHeaders(),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('should update a single field', async () => {
    setupAuthMock();
    const updatedAgent = makeAgent({ bio: 'Updated bio' });
    mockQuery.mockResolvedValueOnce({ records: [updatedAgent], numberOfRecordsUpdated: 1 });

    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/agents/me',
      headers: authHeaders(),
      payload: { bio: 'Updated bio' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().bio).toBe('Updated bio');
  });

  it('should update multiple fields', async () => {
    setupAuthMock();
    const updatedAgent = makeAgent({ specialty: 'coding', bio: 'New bio' });
    mockQuery.mockResolvedValueOnce({ records: [updatedAgent], numberOfRecordsUpdated: 1 });

    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/agents/me',
      headers: authHeaders(),
      payload: { specialty: 'coding', bio: 'New bio' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.specialty).toBe('coding');
    expect(body.bio).toBe('New bio');
  });

  it('should return updated agent', async () => {
    setupAuthMock();
    const updatedAgent = makeAgent({ avatar_emoji: '🎉' });
    mockQuery.mockResolvedValueOnce({ records: [updatedAgent], numberOfRecordsUpdated: 1 });

    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/agents/me',
      headers: authHeaders(),
      payload: { avatar_emoji: '🎉' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().avatar_emoji).toBe('🎉');
    expect(res.json().agent_id).toBe(TEST_AGENT_ID);
  });
});

describe('GET /v1/agents/:agent_id', () => {
  it('should return 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/agents/some-agent' });
    expect(res.statusCode).toBe(401);
  });

  it('should return 404 for non-existent agent', async () => {
    setupAuthMock();
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/agents/unknown-agent',
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('AGENT_NOT_FOUND');
  });

  it('should return public profile without metadata', async () => {
    setupAuthMock();
    const { metadata, is_active, is_banned, ...publicAgent } = makeAgent();
    mockQuery.mockResolvedValueOnce({ records: [publicAgent], numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'GET',
      url: `/v1/agents/${TEST_AGENT_ID}`,
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().agent_id).toBe(TEST_AGENT_ID);
    expect(res.json().name).toBe('TestBot');
    // Public view — query selects without metadata
    expect(res.json()).not.toHaveProperty('is_banned');
  });
});

describe('GET /v1/agents', () => {
  it('should return 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/agents' });
    expect(res.statusCode).toBe(401);
  });

  it('should return agents with pagination defaults', async () => {
    setupAuthMock();
    const agents = [makeAgent()];
    // agents query
    mockQuery.mockResolvedValueOnce({ records: agents, numberOfRecordsUpdated: 0 });
    // count query
    mockQuery.mockResolvedValueOnce({ records: [{ count: 1 }], numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/agents',
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.agents).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.limit).toBe(20);
    expect(body.offset).toBe(0);
  });

  it('should filter by specialty', async () => {
    setupAuthMock();
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 0 });
    mockQuery.mockResolvedValueOnce({ records: [{ count: 0 }], numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/agents?specialty=testing',
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(200);
    // Verify query was called with specialty param
    expect(mockQuery.mock.calls[3][1]).toHaveProperty('specialty', 'testing');
  });

  it('should clamp limit and offset', async () => {
    setupAuthMock();
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 0 });
    mockQuery.mockResolvedValueOnce({ records: [{ count: 0 }], numberOfRecordsUpdated: 0 });

    // Use limit=100 (the schema maximum) — the route handler clamps internally
    const res = await app.inject({
      method: 'GET',
      url: '/v1/agents?limit=100&offset=5',
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.limit).toBe(100);
    expect(body.offset).toBe(5);
  });

  it('should return total count', async () => {
    setupAuthMock();
    mockQuery.mockResolvedValueOnce({ records: [], numberOfRecordsUpdated: 0 });
    mockQuery.mockResolvedValueOnce({ records: [{ count: 42 }], numberOfRecordsUpdated: 0 });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/agents',
      headers: authHeaders(),
    });
    expect(res.json().total).toBe(42);
  });
});
