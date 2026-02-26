import awsLambdaFastify from '@fastify/aws-lambda';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { buildApp } from './app';

const sm = new SecretsManagerClient({});

async function resolveSecret(arnEnvVar: string): Promise<string | undefined> {
  const arn = process.env[arnEnvVar];
  if (!arn) return undefined;
  const result = await sm.send(
    new GetSecretValueCommand({ SecretId: arn })
  );
  return result.SecretString;
}

let proxyPromise: ReturnType<typeof initProxy> | undefined;

async function initProxy() {
  // Resolve secrets from Secrets Manager ARNs → actual values
  const [adminSecret, backupApiUrl, observerPassword] = await Promise.all([
    resolveSecret('ADMIN_SECRET_ARN'),
    resolveSecret('BACKUP_API_URL_SECRET_ARN'),
    resolveSecret('OBSERVER_PASSWORD_SECRET_ARN'),
  ]);

  if (adminSecret) process.env.ADMIN_SECRET = adminSecret;
  if (backupApiUrl) process.env.BACKUP_API_URL = backupApiUrl;
  if (observerPassword) process.env.OBSERVER_PASSWORD = observerPassword;

  // Map rate limit table env var
  if (process.env.DYNAMODB_RATE_LIMIT_TABLE) {
    process.env.RATE_LIMIT_TABLE = process.env.DYNAMODB_RATE_LIMIT_TABLE;
  }

  const app = buildApp();
  return awsLambdaFastify(app);
}

export const handler = async (event: any, context: any) => {
  if (!proxyPromise) {
    proxyPromise = initProxy();
  }
  const proxy = await proxyPromise;
  return proxy(event, context);
};
