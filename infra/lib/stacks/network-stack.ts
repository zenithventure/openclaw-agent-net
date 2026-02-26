import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface NetworkStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.IVpc;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `${props.config.prefix}-vpc`,
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    this.vpc = vpc;

    new cdk.CfnOutput(this, 'VpcId', { value: vpc.vpcId });
  }
}
