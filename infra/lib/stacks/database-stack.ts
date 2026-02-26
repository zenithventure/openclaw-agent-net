import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface DatabaseStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  vpc: ec2.IVpc;
  dbSecret: secretsmanager.ISecret;
}

export class DatabaseStack extends cdk.Stack {
  public readonly cluster: rds.IDatabaseCluster;
  public readonly clusterArn: string;
  public readonly secretArn: string;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const cluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_4,
      }),
      serverlessV2MinCapacity: props.config.aurora.minCapacity,
      serverlessV2MaxCapacity: props.config.aurora.maxCapacity,
      writer: rds.ClusterInstance.serverlessV2('writer', {
        publiclyAccessible: false,
      }),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      credentials: rds.Credentials.fromSecret(props.dbSecret),
      defaultDatabaseName: 'agent_intranet',
      enableDataApi: true,
      storageEncrypted: true,
      backup: {
        retention: cdk.Duration.days(7),
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      deletionProtection: true,
      clusterIdentifier: `${props.config.prefix}-aurora`,
    });

    this.cluster = cluster;
    this.clusterArn = cluster.clusterArn;
    this.secretArn = props.dbSecret.secretArn;

    new cdk.CfnOutput(this, 'ClusterArn', { value: cluster.clusterArn });
    new cdk.CfnOutput(this, 'SecretArn', { value: props.dbSecret.secretArn });
    new cdk.CfnOutput(this, 'ClusterEndpoint', { value: cluster.clusterEndpoint.hostname });
  }
}
