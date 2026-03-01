import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSend } = vi.hoisted(() => {
  const mockSend = vi.fn();
  return { mockSend };
});
vi.mock('@aws-sdk/client-dynamodb', () => {
  class MockDynamoDBClient {
    send = mockSend;
  }
  class MockUpdateItemCommand {
    input: any;
    constructor(input: any) { this.input = input; }
  }
  return {
    DynamoDBClient: MockDynamoDBClient,
    UpdateItemCommand: MockUpdateItemCommand,
  };
});

import { checkRateLimit } from '../../../middleware/rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it('should fail-open when RATE_LIMIT_TABLE is not set', async () => {
    const original = process.env.RATE_LIMIT_TABLE;
    delete process.env.RATE_LIMIT_TABLE;
    const result = await checkRateLimit('test', 'id', 10, 60000);
    expect(result).toEqual({ allowed: true });
    if (original !== undefined) {
      process.env.RATE_LIMIT_TABLE = original;
    } else {
      delete process.env.RATE_LIMIT_TABLE;
    }
  });

  it('should send UpdateItemCommand with correct pk/sk', async () => {
    mockSend.mockResolvedValueOnce({});

    await checkRateLimit('login', '1.2.3.4', 10, 3600000);

    expect(mockSend).toHaveBeenCalledTimes(1);
    const cmd = mockSend.mock.calls[0][0];
    expect(cmd.input.Key.pk.S).toBe('login:1.2.3.4');
    // sk should be the window start as a string
    expect(typeof cmd.input.Key.sk.S).toBe('string');
  });

  it('should set correct max in ConditionExpression values', async () => {
    mockSend.mockResolvedValueOnce({});

    await checkRateLimit('post', 'agent-1', 10, 3600000);

    const cmd = mockSend.mock.calls[0][0];
    expect(cmd.input.ExpressionAttributeValues[':max'].N).toBe('10');
  });

  it('should set TTL to 1 hour after window end', async () => {
    mockSend.mockResolvedValueOnce({});

    const windowMs = 3600000;
    const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
    const expectedTtl = Math.floor((windowStart + windowMs) / 1000) + 3600;

    await checkRateLimit('test', 'id', 10, windowMs);

    const cmd = mockSend.mock.calls[0][0];
    expect(Number(cmd.input.ExpressionAttributeValues[':expires_at'].N)).toBe(expectedTtl);
  });

  it('should return allowed: true on success', async () => {
    mockSend.mockResolvedValueOnce({});
    const result = await checkRateLimit('test', 'id', 10, 60000);
    expect(result).toEqual({ allowed: true });
  });

  it('should return allowed: false with retryAfter on ConditionalCheckFailedException', async () => {
    const err = new Error('Condition not met');
    err.name = 'ConditionalCheckFailedException';
    mockSend.mockRejectedValueOnce(err);

    const result = await checkRateLimit('test', 'id', 10, 60000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThanOrEqual(1);
  });

  it('should ensure retryAfter is at least 1', async () => {
    const err = new Error('Condition not met');
    err.name = 'ConditionalCheckFailedException';
    mockSend.mockRejectedValueOnce(err);

    const result = await checkRateLimit('test', 'id', 10, 60000);
    expect(result.retryAfter).toBeGreaterThanOrEqual(1);
  });

  it('should fail-open on other DynamoDB errors', async () => {
    mockSend.mockRejectedValueOnce(new Error('DynamoDB unavailable'));
    const result = await checkRateLimit('test', 'id', 10, 60000);
    expect(result).toEqual({ allowed: true });
  });

  it('should use correct TableName from env', async () => {
    mockSend.mockResolvedValueOnce({});
    await checkRateLimit('test', 'id', 10, 60000);
    const cmd = mockSend.mock.calls[0][0];
    expect(cmd.input.TableName).toBe('test-rate-limit');
  });
});
