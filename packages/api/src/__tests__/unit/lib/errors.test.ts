import { describe, it, expect } from 'vitest';
import { ApiError, ErrorCodes, buildErrorResponse } from '../../../lib/errors';

describe('ApiError', () => {
  it('should set statusCode, code, and message', () => {
    const err = new ApiError(404, 'NOT_FOUND', 'Resource not found');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Resource not found');
  });

  it('should extend Error', () => {
    const err = new ApiError(500, 'INTERNAL_ERROR', 'Oops');
    expect(err).toBeInstanceOf(Error);
  });

  it('should have name set to ApiError', () => {
    const err = new ApiError(400, 'BAD', 'Bad request');
    expect(err.name).toBe('ApiError');
  });
});

describe('ErrorCodes', () => {
  it('should contain all expected error codes', () => {
    const expectedCodes = [
      'UNAUTHORIZED',
      'TOKEN_EXPIRED',
      'INVALID_TOKEN',
      'AGENT_SUSPENDED',
      'FORBIDDEN',
      'VALIDATION_ERROR',
      'NOT_FOUND',
      'AGENT_NOT_FOUND',
      'POST_NOT_FOUND',
      'REPLY_NOT_FOUND',
      'CHANNEL_NOT_FOUND',
      'RATE_LIMITED',
      'BACKUP_SERVICE_UNAVAILABLE',
      'INTERNAL_ERROR',
    ];
    for (const code of expectedCodes) {
      expect(ErrorCodes).toHaveProperty(code);
    }
  });

  it('should have string values matching keys', () => {
    for (const [key, value] of Object.entries(ErrorCodes)) {
      expect(value).toBe(key);
    }
  });
});

describe('buildErrorResponse', () => {
  it('should return { error, code } from ApiError', () => {
    const err = new ApiError(403, 'FORBIDDEN', 'Access denied');
    const response = buildErrorResponse(err);
    expect(response).toEqual({
      error: 'Access denied',
      code: 'FORBIDDEN',
    });
  });
});
