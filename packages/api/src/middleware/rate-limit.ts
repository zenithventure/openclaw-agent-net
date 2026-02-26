import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

const ddb = new DynamoDBClient({});

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

export async function checkRateLimit(
  category: string,
  identifier: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  const tableName = process.env.RATE_LIMIT_TABLE;
  if (!tableName) {
    // If table not configured, fail open
    return { allowed: true };
  }

  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const pk = `${category}:${identifier}`;
  const sk = String(windowStart);
  const ttl = Math.floor((windowStart + windowMs) / 1000) + 3600;

  try {
    await ddb.send(
      new UpdateItemCommand({
        TableName: tableName,
        Key: {
          pk: { S: pk },
          sk: { S: sk },
        },
        UpdateExpression:
          'SET #count = if_not_exists(#count, :zero) + :one, #ttl = :ttl',
        ExpressionAttributeNames: {
          '#count': 'count',
          '#ttl': 'ttl',
        },
        ExpressionAttributeValues: {
          ':zero': { N: '0' },
          ':one': { N: '1' },
          ':ttl': { N: String(ttl) },
          ':max': { N: String(maxRequests) },
        },
        ConditionExpression:
          'attribute_not_exists(#count) OR #count < :max',
        ReturnValues: 'ALL_NEW',
      })
    );

    return { allowed: true };
  } catch (err: any) {
    if (err.name === 'ConditionalCheckFailedException') {
      const retryAfter = Math.ceil(
        (windowStart + windowMs - Date.now()) / 1000
      );
      return { allowed: false, retryAfter: Math.max(retryAfter, 1) };
    }
    // DynamoDB error - fail open
    console.error('Rate limit check failed:', err);
    return { allowed: true };
  }
}
