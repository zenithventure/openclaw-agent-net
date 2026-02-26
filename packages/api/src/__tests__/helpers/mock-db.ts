import { vi } from 'vitest';
import type { QueryResult } from '../../lib/db';

export const mockQuery = vi.fn<(...args: any[]) => Promise<QueryResult>>();
export const mockBeginTransaction = vi.fn<() => Promise<string>>();
export const mockCommitTransaction = vi.fn<(txId: string) => Promise<void>>();
export const mockRollbackTransaction = vi.fn<(txId: string) => Promise<void>>();

vi.mock('../../lib/db', () => ({
  query: mockQuery,
  beginTransaction: mockBeginTransaction,
  commitTransaction: mockCommitTransaction,
  rollbackTransaction: mockRollbackTransaction,
  toField: vi.fn(),
  toSqlParams: vi.fn(),
  parseField: vi.fn(),
  parseRecords: vi.fn(),
}));

export function mockQueryReturns(records: Record<string, unknown>[], numberOfRecordsUpdated = 0): QueryResult {
  const result: QueryResult = { records, numberOfRecordsUpdated };
  mockQuery.mockResolvedValueOnce(result);
  return result;
}

export function mockQueryEmpty(numberOfRecordsUpdated = 0): QueryResult {
  return mockQueryReturns([], numberOfRecordsUpdated);
}

export function resetDbMocks() {
  mockQuery.mockReset();
  mockBeginTransaction.mockReset();
  mockCommitTransaction.mockReset();
  mockRollbackTransaction.mockReset();
}
