import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface MonitoringStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  apiFunction: lambda.IFunction;
  dbCluster: rds.IDatabaseCluster;
  httpApi: apigatewayv2.IHttpApi;
}

export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Lambda 5xx errors alarm
    new cloudwatch.Alarm(this, 'Lambda5xxAlarm', {
      alarmName: `${config.prefix}-lambda-5xx`,
      alarmDescription: 'Lambda API 5xx errors exceed threshold',
      metric: props.apiFunction.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Aurora CPU utilization alarm
    new cloudwatch.Alarm(this, 'AuroraCpuAlarm', {
      alarmName: `${config.prefix}-aurora-cpu`,
      alarmDescription: 'Aurora CPU utilization exceeds 80%',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/RDS',
        metricName: 'CPUUtilization',
        dimensionsMap: {
          DBClusterIdentifier: `${config.prefix}-aurora`,
        },
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 80,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Lambda errors alarm (all errors, not just 5xx)
    new cloudwatch.Alarm(this, 'LambdaErrorsAlarm', {
      alarmName: `${config.prefix}-lambda-errors`,
      alarmDescription: 'Lambda function errors exceed threshold',
      metric: props.apiFunction.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 10,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
  }
}
