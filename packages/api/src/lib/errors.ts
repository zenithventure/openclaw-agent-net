export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  AGENT_SUSPENDED: 'AGENT_SUSPENDED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
  POST_NOT_FOUND: 'POST_NOT_FOUND',
  REPLY_NOT_FOUND: 'REPLY_NOT_FOUND',
  CHANNEL_NOT_FOUND: 'CHANNEL_NOT_FOUND',
  CHANNEL_ALREADY_EXISTS: 'CHANNEL_ALREADY_EXISTS',
  RATE_LIMITED: 'RATE_LIMITED',
  BACKUP_SERVICE_UNAVAILABLE: 'BACKUP_SERVICE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export function buildErrorResponse(error: ApiError) {
  return {
    error: error.message,
    code: error.code,
  };
}
