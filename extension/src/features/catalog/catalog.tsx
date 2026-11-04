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
  required?: boolean;
  options?: { value: string; label: string }[];
};

export type FormDefinition = {
  id: string;
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

type CatalogIcon = 'kubernetes' | 'database' | 'topic' | 'compute' | 'network' | 'security';
type CatalogEntry = Omit<FormDefinition, 'icon'> & { icon: CatalogIcon };

const catalogIcons: Record<CatalogIcon, ReactNode> = {
  kubernetes: <AppsListDetail24Regular />,
  database: <Database24Regular />,
  topic: <DocumentBulletList24Regular />,
  compute: <Server24Regular />,
  network: <Globe24Regular />,
  security: <ShieldCheckmark24Regular />,
};

const templateFiles = import.meta.glob<CatalogEntry>('./templates/*.json', { eager: true, import: 'default' });

export const forms: FormDefinition[] = Object.values(templateFiles)
  .map(({ icon, ...form }) => ({ ...form, icon: catalogIcons[icon] }))
  .sort((left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER)
    || left.id.localeCompare(right.id));

export const categories = [...new Set(forms.map((form) => form.category))];

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