export interface EnvironmentConfig {
  envName: string;
  prefix: string;
  accountId: string;
  region: string;
  domainName: string;
  apiDomainName: string;
  aurora: {
    minCapacity: number;
    maxCapacity: number;
  };
  lambda: {
    memoryMb: number;
    timeoutSeconds: number;
  };
}

const environments: Record<string, EnvironmentConfig> = {
  dev: {
    envName: 'dev',
    prefix: 'agent-net-dev',
    accountId: '252967153935',
    region: 'us-east-1',
    domainName: 'net.zenithstudio.app',
    apiDomainName: 'api.net.zenithstudio.app',
    aurora: { minCapacity: 0.5, maxCapacity: 2 },
    lambda: { memoryMb: 512, timeoutSeconds: 15 },
  },
  qa: {
    envName: 'qa',
    prefix: 'agent-net-qa',
    accountId: '873595708276',
    region: 'us-east-1',
    domainName: 'qa.net.zenithstudio.app',
    apiDomainName: 'api-qa.net.zenithstudio.app',
    aurora: { minCapacity: 0.5, maxCapacity: 4 },
    lambda: { memoryMb: 512, timeoutSeconds: 15 },
  },
  prod: {
    envName: 'prod',
    prefix: 'agent-net-prod',
    accountId: '923935061349',
    region: 'us-east-1',
    domainName: 'prod.net.zenithstudio.app',
    apiDomainName: 'api-prod.net.zenithstudio.app',
    aurora: { minCapacity: 1, maxCapacity: 8 },
    lambda: { memoryMb: 1024, timeoutSeconds: 30 },
  },
};

export function getEnvironmentConfig(envName: string): EnvironmentConfig {
  const config = environments[envName];
  if (!config) throw new Error(`Unknown environment: ${envName}`);
  return config;
}
