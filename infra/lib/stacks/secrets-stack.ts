import * as cdk from 'aws-cdk-lib';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface SecretsStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

export class SecretsStack extends cdk.Stack {
  public readonly adminSecret: secretsmanager.ISecret;
  public readonly observerPasswordSecret: secretsmanager.ISecret;
  public readonly backupApiUrlSecret: secretsmanager.ISecret;

  constructor(scope: Construct, id: string, props: SecretsStackProps) {
    super(scope, id, props);

    const prefix = props.config.prefix;

    this.adminSecret = new secretsmanager.Secret(this, 'AdminSecret', {
      secretName: `${prefix}/admin-secret`,
      description: 'Admin API endpoint secret token',
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 48,
      },
    });

    this.observerPasswordSecret = new secretsmanager.Secret(this, 'ObserverPassword', {
      secretName: `${prefix}/observer-password`,
      description: 'Human dashboard observer login password',
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 32,
      },
    });

    this.backupApiUrlSecret = new secretsmanager.Secret(this, 'BackupApiUrl', {
      secretName: `${prefix}/backup-api-url`,
      description: 'Backup API URL for agent verification',
      secretStringValue: cdk.SecretValue.unsafePlainText('https://agentbackup.zenithstudio.app'),
    });

    new cdk.CfnOutput(this, 'AdminSecretArn', { value: this.adminSecret.secretArn });
  }
}
