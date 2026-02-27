import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need to test the actual implementations, so we import them directly
// but mock the AWS SDK client
const { mockSend } = vi.hoisted(() => {
  const mockSend = vi.fn();
  return { mockSend };
});
vi.mock('@aws-sdk/client-rds-data', async () => {
  const actual = await vi.importActual<typeof import('@aws-sdk/client-rds-data')>('@aws-sdk/client-rds-data');
  class MockRDSDataClient {
    send = mockSend;
  }
  return {
    ...actual,
    RDSDataClient: MockRDSDataClient,
  };
});

import type { Field } from '@aws-sdk/client-rds-data';
import {
  toField,
  toSqlParams,
  parseField,
  parseRecords,
  query,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
} from '../../../lib/db';

describe('toField', () => {
  it('should convert null to isNull', () => {
    expect(toField(null)).toEqual({ isNull: true });
  });

  it('should convert undefined to isNull', () => {
    expect(toField(undefined)).toEqual({ isNull: true });
  });

  it('should convert boolean true', () => {
    expect(toField(true)).toEqual({ booleanValue: true });
  });

  it('should convert boolean false', () => {
    expect(toField(false)).toEqual({ booleanValue: false });
  });

  it('should convert integer to longValue', () => {
    expect(toField(42)).toEqual({ longValue: 42 });
  });

  it('should convert float to doubleValue', () => {
    expect(toField(3.14)).toEqual({ doubleValue: 3.14 });
  });

  it('should convert string to stringValue', () => {
    expect(toField('hello')).toEqual({ stringValue: 'hello' });
  });

  it('should convert array to PG array literal', () => {
    expect(toField(['a', 'b'])).toEqual({ stringValue: '{"a","b"}' });
  });

  it('should escape quotes in array elements', () => {
    expect(toField(['a"b'])).toEqual({ stringValue: '{"a\\"b"}' });
  });

  it('should convert object to JSON string', () => {
    expect(toField({ key: 'value' })).toEqual({ stringValue: '{"key":"value"}' });
  });
});

describe('toSqlParams', () => {
  it('should convert empty object to empty array', () => {
    expect(toSqlParams({})).toEqual([]);
  });

  it('should convert mixed types', () => {
    const result = toSqlParams({ name: 'alice', age: 30, active: true });
    expect(result).toEqual([
      { name: 'name', value: { stringValue: 'alice' } },
      { name: 'age', value: { longValue: 30 } },
      { name: 'active', value: { booleanValue: true } },
    ]);
  });
});

describe('parseField', () => {
  it('should parse isNull', () => {
    expect(parseField({ isNull: true })).toBeNull();
  });

  it('should parse booleanValue', () => {
    expect(parseField({ booleanValue: true })).toBe(true);
  });

  it('should parse longValue', () => {
    expect(parseField({ longValue: 99 })).toBe(99);
  });

  it('should parse doubleValue', () => {
    expect(parseField({ doubleValue: 1.5 })).toBe(1.5);
  });

  it('should parse stringValue', () => {
    expect(parseField({ stringValue: 'test' })).toBe('test');
  });

  it('should parse blobValue', () => {
    const blob = new Uint8Array([1, 2, 3]);
    expect(parseField({ blobValue: blob })).toBe(blob);
  });

  it('should parse arrayValue', () => {
    const arr = { stringValues: ['a', 'b'] };
    expect(parseField({ arrayValue: arr })).toBe(arr);
  });

  it('should return null for empty field', () => {
    expect(parseField({} as Field)).toBeNull();
  });
});

describe('parseRecords', () => {
  it('should return empty array when metadata is undefined', () => {
    expect(parseRecords(undefined, [[{ stringValue: 'x' }]])).toEqual([]);
  });

  it('should return empty array when records is undefined', () => {
    expect(parseRecords([{ name: 'col' }], undefined)).toEqual([]);
  });

  it('should parse single row', () => {
    const metadata = [{ name: 'id' }, { name: 'name' }];
    const records = [[{ longValue: 1 }, { stringValue: 'alice' }]];
    expect(parseRecords(metadata, records)).toEqual([{ id: 1, name: 'alice' }]);
  });

  it('should parse multiple rows', () => {
    const metadata = [{ name: 'val' }];
    const records = [[{ stringValue: 'a' }], [{ stringValue: 'b' }]];
    expect(parseRecords(metadata, records)).toEqual([{ val: 'a' }, { val: 'b' }]);
  });

  it('should skip columns without name', () => {
    const metadata = [{ name: 'x' }, {}, { name: 'z' }];
    const records = [[{ longValue: 1 }, { longValue: 2 }, { longValue: 3 }]];
    const result = parseRecords(metadata, records);
    expect(result).toEqual([{ x: 1, z: 3 }]);
    expect(result[0]).not.toHaveProperty('undefined');
  });
});

describe('query', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it('should pass correct ARNs and database', async () => {
    mockSend.mockResolvedValueOnce({
      columnMetadata: [],
      records: [],
      numberOfRecordsUpdated: 0,
    });

    await query('SELECT 1');

    const cmd = mockSend.mock.calls[0][0];
    expect(cmd.input.resourceArn).toBe(process.env.AURORA_CLUSTER_ARN);
    expect(cmd.input.secretArn).toBe(process.env.AURORA_SECRET_ARN);
    expect(cmd.input.database).toBe(process.env.DB_NAME);
    expect(cmd.input.sql).toBe('SELECT 1');
    expect(cmd.input.includeResultMetadata).toBe(true);
  });

  it('should pass parameters when provided', async () => {
    mockSend.mockResolvedValueOnce({
      columnMetadata: [],
      records: [],
      numberOfRecordsUpdated: 0,
    });

    await query('SELECT :id', { id: 42 });

    const cmd = mockSend.mock.calls[0][0];
    expect(cmd.input.parameters).toEqual([
      { name: 'id', value: { longValue: 42 } },
    ]);
  });

  it('should pass transactionId when provided', async () => {
    mockSend.mockResolvedValueOnce({
      columnMetadata: [],
      records: [],
      numberOfRecordsUpdated: 0,
    });

    await query('SELECT 1', undefined, 'tx-123');

    const cmd = mockSend.mock.calls[0][0];
    expect(cmd.input.transactionId).toBe('tx-123');
  });

  it('should parse result records', async () => {
    mockSend.mockResolvedValueOnce({
      columnMetadata: [{ name: 'count' }],
      records: [[{ longValue: 5 }]],
      numberOfRecordsUpdated: 0,
    });

    const result = await query('SELECT COUNT(*) AS count');
    expect(result.records).toEqual([{ count: 5 }]);
  });

  it('should propagate errors', async () => {
    mockSend.mockRejectedValueOnce(new Error('DB down'));
    await expect(query('SELECT 1')).rejects.toThrow('DB down');
  });
});

describe('beginTransaction', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it('should return transactionId', async () => {
    mockSend.mockResolvedValueOnce({ transactionId: 'tx-abc' });
    const txId = await beginTransaction();
    expect(txId).toBe('tx-abc');
  });

  it('should pass correct ARNs', async () => {
    mockSend.mockResolvedValueOnce({ transactionId: 'tx-abc' });
    await beginTransaction();
    const cmd = mockSend.mock.calls[0][0];
    expect(cmd.input.resourceArn).toBe(process.env.AURORA_CLUSTER_ARN);
    expect(cmd.input.secretArn).toBe(process.env.AURORA_SECRET_ARN);
  });
});

describe('commitTransaction', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it('should pass transactionId', async () => {
    mockSend.mockResolvedValueOnce({});
    await commitTransaction('tx-123');
    const cmd = mockSend.mock.calls[0][0];
    expect(cmd.input.transactionId).toBe('tx-123');
  });
});

describe('rollbackTransaction', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it('should pass transactionId', async () => {
    mockSend.mockResolvedValueOnce({});
    await rollbackTransaction('tx-456');
    const cmd = mockSend.mock.calls[0][0];
    expect(cmd.input.transactionId).toBe('tx-456');
  });
});
