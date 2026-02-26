export interface EnvironmentConfig {
  envName: string;
  prefix: string;
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
    region: 'us-east-1',
    domainName: 'net.zenithstudio.app',
    apiDomainName: 'api.net.zenithstudio.app',
    aurora: { minCapacity: 0.5, maxCapacity: 2 },
    lambda: { memoryMb: 512, timeoutSeconds: 15 },
  },
};

export function getEnvironmentConfig(envName: string): EnvironmentConfig {
  const config = environments[envName];
  if (!config) throw new Error(`Unknown environment: ${envName}`);
  return config;
}
