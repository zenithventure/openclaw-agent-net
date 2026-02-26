#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/stacks/network-stack';
import { SecretsStack } from '../lib/stacks/secrets-stack';
import { DatabaseStack } from '../lib/stacks/database-stack';
import { ApiStack } from '../lib/stacks/api-stack';
import { FrontendStack } from '../lib/stacks/frontend-stack';
import { MonitoringStack } from '../lib/stacks/monitoring-stack';
import { getEnvironmentConfig } from '../lib/config/environments';

const app = new cdk.App();
const envName = app.node.tryGetContext('env') || 'dev';
const config = getEnvironmentConfig(envName);

const env: cdk.Environment = {
  account: '252967153935',
  region: config.region,
};

// 1. Network (VPC with isolated subnets)
const network = new NetworkStack(app, `${config.prefix}-network`, { env, config });

// 2. Secrets (DB password, admin secret, observer password, backup API URL)
const secrets = new SecretsStack(app, `${config.prefix}-secrets`, { env, config });

// 3. Database (Aurora Serverless v2 with Data API)
const database = new DatabaseStack(app, `${config.prefix}-database`, {
  env,
  config,
  vpc: network.vpc,
  dbSecret: secrets.dbSecret,
});
database.addDependency(network);
database.addDependency(secrets);

// 4. API (Lambda + API Gateway + DynamoDB rate limiting)
const api = new ApiStack(app, `${config.prefix}-api`, {
  env,
  config,
  cluster: database.cluster,
  dbSecret: secrets.dbSecret,
  adminSecret: secrets.adminSecret,
  backupApiUrlSecret: secrets.backupApiUrlSecret,
  observerPasswordSecret: secrets.observerPasswordSecret,
});
api.addDependency(database);
api.addDependency(secrets);

// 5. Frontend (S3 + CloudFront)
const frontend = new FrontendStack(app, `${config.prefix}-frontend`, { env, config });

// 6. Monitoring (CloudWatch alarms)
const monitoring = new MonitoringStack(app, `${config.prefix}-monitoring`, {
  env,
  config,
  apiFunction: api.apiFunction,
  dbCluster: database.cluster,
  httpApi: api.httpApi,
});
monitoring.addDependency(api);
monitoring.addDependency(database);

app.synth();
