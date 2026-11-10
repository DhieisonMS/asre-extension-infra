import type { ReactNode } from 'react';
import {
  AppsListDetail24Regular, Database24Regular, DocumentBulletList24Regular,
  Globe24Regular, Server24Regular, ShieldCheckmark24Regular,
} from '@fluentui/react-icons';

export type FormField = {
  name: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'number' | 'textarea' | 'select';
  valueType?: 'string' | 'number' | 'boolean' | 'string[]' | 'json';
  required?: boolean;
  options?: { value: string; label: string }[];
};

export type FormDefinition = {
  id: string;
  provider: CloudProvider;
  title: string;
  description: string;
  category: string;
  resourceLabel: string;
  resourcePlaceholder: string;
  fields: FormField[];
  icon: ReactNode;
  resourceNameTemplate?: string;
  generatedResourceNameLabel?: string;
  resourceNameValidation?: { pattern?: string; maxLength?: number; message?: string };
  order?: number;
};

export type CloudProvider = 'aws' | 'gcp' | 'mongodbatlas' | 'oracle';

export const cloudProviders: { id: CloudProvider; label: string }[] = [
  { id: 'aws', label: 'AWS' },
  { id: 'gcp', label: 'GCP' },
  { id: 'mongodbatlas', label: 'MongoDB Atlas' },
  { id: 'oracle', label: 'Oracle' },
];

type CatalogIcon = 'kubernetes' | 'database' | 'topic' | 'compute' | 'network' | 'security';

const catalogIcons: Record<CatalogIcon, ReactNode> = {
  kubernetes: <AppsListDetail24Regular />,
  database: <Database24Regular />,
  topic: <DocumentBulletList24Regular />,
  compute: <Server24Regular />,
  network: <Globe24Regular />,
  security: <ShieldCheckmark24Regular />,
};

function isCatalogIcon(value: unknown): value is CatalogIcon {
  return typeof value === 'string' && Object.hasOwn(catalogIcons, value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCatalogField(value: unknown): value is FormField {
  if (!isRecord(value) || typeof value.name !== 'string' || !/^[A-Za-z][A-Za-z0-9]*$/.test(value.name)
    || typeof value.label !== 'string' || value.label.trim().length === 0) return false;
  if (value.placeholder !== undefined && typeof value.placeholder !== 'string') return false;
  if (value.required !== undefined && typeof value.required !== 'boolean') return false;
  if (value.type !== undefined && !['text', 'number', 'textarea', 'select'].includes(String(value.type))) return false;
  if (value.valueType !== undefined && !['string', 'number', 'boolean', 'string[]', 'json'].includes(String(value.valueType))) return false;
  if (value.options !== undefined && (!Array.isArray(value.options)
    || value.options.length === 0
    || !value.options.every((option) => isRecord(option) && typeof option.value === 'string'
      && typeof option.label === 'string' && option.label.trim().length > 0))) return false;
  return value.type !== 'select' || (Array.isArray(value.options) && value.options.length > 0);
}

function parseCatalogEntry(value: unknown, provider: CloudProvider, fileName: string): FormDefinition {
  const invalid = () => new Error(`Template "${fileName}" inválido: confira o formato do catálogo e o provedor "${provider}".`);
  if (!isRecord(value)
    || value.provider !== provider
    || typeof value.id !== 'string'
    || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.id)
    || typeof value.title !== 'string' || value.title.trim().length === 0
    || typeof value.description !== 'string' || value.description.trim().length === 0
    || typeof value.category !== 'string' || value.category.trim().length === 0
    || typeof value.resourceLabel !== 'string' || value.resourceLabel.trim().length === 0
    || typeof value.resourcePlaceholder !== 'string'
    || !isCatalogIcon(value.icon)
    || !Array.isArray(value.fields)
    || !value.fields.every(isCatalogField)) throw invalid();

  if (value.order !== undefined && (!Number.isInteger(value.order) || Number(value.order) < 0)) throw invalid();
  if (value.resourceNameTemplate !== undefined && typeof value.resourceNameTemplate !== 'string') throw invalid();
  if (value.generatedResourceNameLabel !== undefined && typeof value.generatedResourceNameLabel !== 'string') throw invalid();

  let resourceNameValidation: FormDefinition['resourceNameValidation'];
  if (value.resourceNameValidation !== undefined) {
    const validation = value.resourceNameValidation;
    if (!isRecord(validation)
      || (validation.pattern !== undefined && typeof validation.pattern !== 'string')
      || (validation.maxLength !== undefined && (!Number.isInteger(validation.maxLength) || Number(validation.maxLength) < 1))
      || (validation.message !== undefined && typeof validation.message !== 'string')) throw invalid();
    if (typeof validation.pattern === 'string') {
      try {
        new RegExp(validation.pattern);
      } catch {
        throw invalid();
      }
    }
    resourceNameValidation = {
      ...(typeof validation.pattern === 'string' ? { pattern: validation.pattern } : {}),
      ...(typeof validation.maxLength === 'number' ? { maxLength: validation.maxLength } : {}),
      ...(typeof validation.message === 'string' ? { message: validation.message } : {}),
    };
  }

  return {
    id: value.id,
    provider,
    title: value.title,
    description: value.description,
    category: value.category,
    resourceLabel: value.resourceLabel,
    resourcePlaceholder: value.resourcePlaceholder,
    fields: value.fields,
    icon: catalogIcons[value.icon],
    ...(typeof value.resourceNameTemplate === 'string' ? { resourceNameTemplate: value.resourceNameTemplate } : {}),
    ...(typeof value.generatedResourceNameLabel === 'string' ? { generatedResourceNameLabel: value.generatedResourceNameLabel } : {}),
    ...(resourceNameValidation ? { resourceNameValidation } : {}),
    ...(typeof value.order === 'number' ? { order: value.order } : {}),
  };
}

export function parseCatalogTemplates(entries: { name: string; content: string }[], provider: CloudProvider): FormDefinition[] {
  return entries
    .map(({ name, content }) => {
      let data: unknown;
      try {
        data = JSON.parse(content) as unknown;
      } catch {
        throw new Error(`Template "${name}" não contém JSON válido.`);
      }
      return parseCatalogEntry(data, provider, name);
    })
    .sort((left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER)
      || left.id.localeCompare(right.id));
}

export function categoriesForProvider(provider: CloudProvider, catalog: FormDefinition[]): string[] {
  return [...new Set(catalog.filter((form) => form.provider === provider).map((form) => form.category))];
}

export type ProvisioningRequest = {
  schemaVersion: 1;
  provider: CloudProvider;
  templateId: string;
  resourceType: string;
  accountDomain: string;
  accountAwsName: string;
  accountAwsId: string;
  vpcId: string;
  resourceName: string;
  environment: string;
  region: string;
  subnets: string[];
  justification: string;
  [key: string]: unknown;
};

export function buildProvisioningRequest(
  form: FormDefinition,
  values: Record<string, string>,
  request: Pick<ProvisioningRequest, 'accountDomain' | 'accountAwsName' | 'accountAwsId' | 'vpcId' | 'resourceName' | 'environment' | 'region' | 'subnets' | 'justification'>,
): ProvisioningRequest {
  const reservedFields = new Set([
    'schemaVersion', 'provider', 'templateId', 'resourceType', 'accountDomain',
    'accountAwsName', 'accountAwsId', 'vpcId', 'resourceName', 'environment',
    'region', 'subnets', 'justification', 'parameters',
  ]);
  const resourceFields: Record<string, unknown> = {};

  form.fields.forEach((field) => {
    const rawValue = values[field.name]?.trim() ?? '';
    if (!rawValue) return;

    const valueType = field.valueType ?? (field.type === 'number' ? 'number' : 'string');
    let value: unknown;
    if (valueType === 'number') {
      const numericValue = Number(rawValue);
      if (!Number.isFinite(numericValue)) throw new Error(`O campo "${field.label}" precisa conter um número válido.`);
      value = numericValue;
    } else if (valueType === 'boolean') {
      if (rawValue !== 'true' && rawValue !== 'false') throw new Error(`O campo "${field.label}" precisa ser true ou false.`);
      value = rawValue === 'true';
    } else if (valueType === 'string[]') {
      const arrayValue = rawValue.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
      if (arrayValue.length === 0) throw new Error(`Informe ao menos um valor para "${field.label}".`);
      value = arrayValue;
    } else if (valueType === 'json') {
      try {
        value = JSON.parse(rawValue) as unknown;
      } catch {
        throw new Error(`O campo "${field.label}" precisa conter um JSON válido.`);
      }
      if (typeof value !== 'object' || value === null) throw new Error(`O campo "${field.label}" precisa conter um objeto ou array JSON.`);
    } else {
      value = rawValue;
    }

    const requestField = field.name === 'subnetIds' ? 'subnets' : field.name;
    if (requestField === 'vpcId') {
      if (value !== request.vpcId) throw new Error(`O campo "${field.label}" não corresponde à VPC selecionada.`);
      return;
    }
    if (requestField === 'subnets') {
      if (!Array.isArray(value) || !value.every((subnet) => typeof subnet === 'string')
        || !value.every((subnet) => request.subnets.includes(subnet))) {
        throw new Error(`O campo "${field.label}" contém subnets não configuradas para esta conta.`);
      }
    } else if (reservedFields.has(requestField)) {
      throw new Error(`O campo "${field.label}" usa o nome reservado "${requestField}".`);
    }
    if (Object.prototype.hasOwnProperty.call(resourceFields, requestField)) {
      throw new Error(`Mais de um campo do formulário gera a propriedade "${requestField}" no pedido.`);
    }
    resourceFields[requestField] = value;
  });

  return {
    schemaVersion: 1,
    provider: form.provider,
    templateId: form.id,
    resourceType: form.id,
    ...request,
    ...resourceFields,
  };
}

export function buildResourceName(form: FormDefinition, resourceName: string, environment: string): string {
  return (form.resourceNameTemplate ?? '{resourceName}')
    .replaceAll('{resourceName}', resourceName.trim())
    .replaceAll('{environment}', environment);
}

export function pipelineFromUrl(value: string): { id: number; project: string } | undefined {
  try {
    const url = new URL(value);
    const id = url.searchParams.get('definitionId') ?? url.pathname.match(/\/_apis\/pipelines\/(\d+)(?:\/|$)/)?.[1];
    const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const routeIndex = Math.max(segments.indexOf('_build'), segments.indexOf('_apis'));
    const project = routeIndex > 1 ? segments[routeIndex - 1] : undefined;
    return id && /^\d+$/.test(id) && project ? { id: Number(id), project } : undefined;
  } catch {
    return undefined;
  }
}