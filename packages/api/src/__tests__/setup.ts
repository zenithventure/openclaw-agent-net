// Set env vars before any module imports (only if not already set, so AWS E2E tests can override)
process.env.AWS_REGION ??= 'us-east-1';
process.env.AURORA_CLUSTER_ARN ??= 'arn:aws:rds:us-east-1:123456789:cluster:test-cluster';
process.env.AURORA_SECRET_ARN ??= 'arn:aws:secretsmanager:us-east-1:123456789:secret:test-secret';
process.env.DB_NAME ??= 'test_db';
process.env.RATE_LIMIT_TABLE ??= 'test-rate-limit';
process.env.ADMIN_SECRET ??= 'test-admin-secret';
process.env.BACKUP_API_URL ??= 'https://backup.test.local';
