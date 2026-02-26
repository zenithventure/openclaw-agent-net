import { vi } from 'vitest';
import type { RateLimitResult } from '../../middleware/rate-limit';

export const mockCheckRateLimit = vi.fn<(...args: any[]) => Promise<RateLimitResult>>();

vi.mock('../../middleware/rate-limit', () => ({
  checkRateLimit: mockCheckRateLimit,
}));

export function mockRateLimitAllowed() {
  mockCheckRateLimit.mockResolvedValueOnce({ allowed: true });
}

export function mockRateLimited(retryAfter = 30) {
  mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter });
}

export function resetRateLimitMocks() {
  mockCheckRateLimit.mockReset();
}
