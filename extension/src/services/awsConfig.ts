import { readTemplateFile } from './adoApi';

export type AwsEnvironmentConfig = {
  accountId: string;
  vpcId: string;
  regions: string[];
  subnets: string[];
};

export type AwsDomainConfig = {
  accountName: string;
  environments: Record<string, AwsEnvironmentConfig>;
};

export type AwsGlobalConfig = {
  domains: AwsDomainConfig[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown, pattern: RegExp): value is string[] {
  return Array.isArray(value) && value.length > 0
    && value.every((item) => typeof item === 'string' && pattern.test(item))
    && new Set(value).size === value.length;
}

export function parseAwsGlobalConfig(value: unknown): AwsGlobalConfig {
  if (!isRecord(value) || !Array.isArray(value.domains) || value.domains.length === 0) {
    throw new Error('aws/globalConfig.json inválido: informe ao menos um domínio em "domains".');
  }

  const domains = value.domains.map((domain): AwsDomainConfig => {
    if (!isRecord(domain)
      || typeof domain.accountName !== 'string'
      || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(domain.accountName)
      || !isRecord(domain.environments)) {
      throw new Error('aws/globalConfig.json inválido: cada domínio precisa de accountName e environments.');
    }

    const environments = Object.fromEntries(Object.entries(domain.environments).map(([name, config]) => {
      if (!['hml', 'uat', 'prd'].includes(name)
        || !isRecord(config)
        || typeof config.accountId !== 'string'
        || !/^\d{12}$/.test(config.accountId)
        || typeof config.vpcId !== 'string'
        || !/^(?:vpc|vpcid)-[a-zA-Z0-9]+$/.test(config.vpcId)
        || !isStringArray(config.regions, /^[a-z0-9-]+$/)
        || !isStringArray(config.subnets, /^subnet-[a-zA-Z0-9]+$/)) {
        throw new Error(`aws/globalConfig.json inválido: configuração incompleta para ${domain.accountName}/${name}.`);
      }

      return [name, {
        accountId: config.accountId,
        vpcId: config.vpcId,
        regions: config.regions,
        subnets: config.subnets,
      }];
    }));

    if (Object.keys(environments).sort().join(',') !== 'hml,prd,uat') {
      throw new Error(`aws/globalConfig.json inválido: ${domain.accountName} precisa configurar hml, uat e prd.`);
    }

    return { accountName: domain.accountName, environments };
  });

  const domainNames = domains.map((domain) => domain.accountName);
  if (new Set(domainNames).size !== domainNames.length) {
    throw new Error('aws/globalConfig.json inválido: accountName deve ser único em "domains".');
  }

  return { domains };
}

export async function loadAwsGlobalConfig(): Promise<AwsGlobalConfig> {
  let content: string;
  try {
    content = await readTemplateFile('/aws/globalConfig.json');
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : 'erro desconhecido';
    throw new Error(`Não foi possível carregar aws/globalConfig.json. ${detail}`);
  }

  let data: unknown;
  try {
    data = JSON.parse(content) as unknown;
  } catch {
    throw new Error('aws/globalConfig.json não contém JSON válido.');
  }

  return parseAwsGlobalConfig(data);
}
