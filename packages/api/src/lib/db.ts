import {
  RDSDataClient,
  ExecuteStatementCommand,
  BatchExecuteStatementCommand,
  BeginTransactionCommand,
  CommitTransactionCommand,
  RollbackTransactionCommand,
  Field,
  SqlParameter,
} from '@aws-sdk/client-rds-data';

const client = new RDSDataClient({ region: process.env.AWS_REGION });

const RESOURCE_ARN = process.env.AURORA_CLUSTER_ARN!;
const SECRET_ARN = process.env.AURORA_SECRET_ARN!;
const DATABASE = process.env.DB_NAME || 'agent_intranet';

function toField(value: unknown): Field {
  if (value === null || value === undefined) {
    return { isNull: true };
  }
  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { longValue: value };
    }
    return { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { stringValue: `{${value.map(v => `"${String(v).replace(/"/g, '\\"')}"`).join(',')}}` };
  }
  if (typeof value === 'object') {
    return { stringValue: JSON.stringify(value) };
  }
  return { stringValue: String(value) };
}

function toSqlParams(params: Record<string, unknown>): SqlParameter[] {
  return Object.entries(params).map(([name, value]) => ({
    name,
    value: toField(value),
  }));
}

export interface QueryResult {
  records: Record<string, unknown>[];
  numberOfRecordsUpdated: number;
}

function parseField(field: Field): unknown {
  if (field.isNull) return null;
  if (field.booleanValue !== undefined) return field.booleanValue;
  if (field.longValue !== undefined) return field.longValue;
  if (field.doubleValue !== undefined) return field.doubleValue;
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.blobValue !== undefined) return field.blobValue;
  if (field.arrayValue !== undefined) return field.arrayValue;
  return null;
}

function parseRecords(
  columnMetadata: { name?: string }[] | undefined,
  records: Field[][] | undefined
): Record<string, unknown>[] {
  if (!columnMetadata || !records) return [];

  return records.map(row => {
    const obj: Record<string, unknown> = {};
    columnMetadata.forEach((col, i) => {
      if (col.name) {
        obj[col.name] = parseField(row[i]);
      }
    });
    return obj;
  });
}

export async function query(
  sql: string,
  params?: Record<string, unknown>,
  transactionId?: string
): Promise<QueryResult> {
  const command = new ExecuteStatementCommand({
    resourceArn: RESOURCE_ARN,
    secretArn: SECRET_ARN,
    database: DATABASE,
    sql,
    parameters: params ? toSqlParams(params) : undefined,
    includeResultMetadata: true,
    transactionId,
  });

  const result = await client.send(command);

  return {
    records: parseRecords(result.columnMetadata, result.records),
    numberOfRecordsUpdated: result.numberOfRecordsUpdated ?? 0,
  };
}

export async function beginTransaction(): Promise<string> {
  const result = await client.send(
    new BeginTransactionCommand({
      resourceArn: RESOURCE_ARN,
      secretArn: SECRET_ARN,
      database: DATABASE,
    })
  );
  return result.transactionId!;
}

export async function commitTransaction(transactionId: string): Promise<void> {
  await client.send(
    new CommitTransactionCommand({
      resourceArn: RESOURCE_ARN,
      secretArn: SECRET_ARN,
      transactionId,
    })
  );
}

export async function rollbackTransaction(transactionId: string): Promise<void> {
  await client.send(
    new RollbackTransactionCommand({
      resourceArn: RESOURCE_ARN,
      secretArn: SECRET_ARN,
      transactionId,
    })
  );
}
