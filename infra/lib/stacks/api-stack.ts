import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface ApiStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  cluster: rds.IDatabaseCluster;
  dbSecret: secretsmanager.ISecret;
  adminSecret: secretsmanager.ISecret;
  backupApiUrlSecret: secretsmanager.ISecret;
  observerPasswordSecret: secretsmanager.ISecret;
}

export class ApiStack extends cdk.Stack {
  public readonly httpApi: apigatewayv2.HttpApi;
  public readonly apiFunction: lambda.Function;
  public readonly rateLimitTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { config } = props;

    // DynamoDB table for rate limiting
    this.rateLimitTable = new dynamodb.Table(this, 'RateLimitTable', {
      tableName: `${config.prefix}-rate-limit`,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expires_at',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda function for Fastify API
    this.apiFunction = new lambda.Function(this, 'ApiFunction', {
      functionName: `${config.prefix}-api`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'lambda.handler',
      code: lambda.Code.fromAsset('../packages/api/dist', {
        exclude: ['*.map'],
      }),
      memorySize: config.lambda.memoryMb,
      timeout: cdk.Duration.seconds(config.lambda.timeoutSeconds),
      environment: {
        NODE_ENV: 'production',
        AURORA_CLUSTER_ARN: props.cluster.clusterArn,
        AURORA_SECRET_ARN: props.dbSecret.secretArn,
        DB_NAME: 'agent_intranet',
        DYNAMODB_RATE_LIMIT_TABLE: this.rateLimitTable.tableName,
        ADMIN_SECRET_ARN: props.adminSecret.secretArn,
        BACKUP_API_URL_SECRET_ARN: props.backupApiUrlSecret.secretArn,
        OBSERVER_PASSWORD_SECRET_ARN: props.observerPasswordSecret.secretArn,
      },
    });

    // IAM permissions for Lambda
    this.apiFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'rds-data:ExecuteStatement',
        'rds-data:BatchExecuteStatement',
        'rds-data:BeginTransaction',
        'rds-data:CommitTransaction',
        'rds-data:RollbackTransaction',
      ],
      resources: [props.cluster.clusterArn],
    }));

    props.dbSecret.grantRead(this.apiFunction);
    props.adminSecret.grantRead(this.apiFunction);
    props.backupApiUrlSecret.grantRead(this.apiFunction);
    props.observerPasswordSecret.grantRead(this.apiFunction);
    this.rateLimitTable.grantReadWriteData(this.apiFunction);

    // API Gateway HTTP API
    this.httpApi = new apigatewayv2.HttpApi(this, 'HttpApi', {
      apiName: `${config.prefix}-api`,
      corsPreflight: {
        allowOrigins: [
          `https://${config.domainName}`,
          'https://d33wvgocwnwbjw.cloudfront.net',
          'http://localhost:3000',
        ],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PATCH,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type', 'Authorization'],
        maxAge: cdk.Duration.hours(1),
      },
    });

    // Default route: proxy all requests to Lambda
    this.httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: new integrations.HttpLambdaIntegration('ApiIntegration', this.apiFunction),
    });

    new cdk.CfnOutput(this, 'ApiUrl', { value: this.httpApi.apiEndpoint });
    new cdk.CfnOutput(this, 'ApiFunctionArn', { value: this.apiFunction.functionArn });
  }
}
