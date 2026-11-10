import * as SDK from 'azure-devops-extension-sdk';

export type AdoProject = { id: string; name: string; state?: string };
export type AdoPipeline = { id: number; name: string; folder?: string; url?: string };
export type PipelineRun = { id: number; name?: string; state?: string; result?: string; url?: string; _links?: { web?: { href?: string } } };

type AdoList<T> = { value: T[]; count?: number };
type GitItem = { path: string; isFolder?: boolean };
type GitItemList = { value: GitItem[]; count?: number };

function organizationUrl(): string {
  const name = SDK.getHost()?.name;
  if (!name) throw new Error('Não foi possível identificar a organização do Azure DevOps. Abra a extensão dentro da organização.');
  return `https://dev.azure.com/${encodeURIComponent(name)}`;
}

async function adoFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await adoRequest(url, init);
  return response.json() as Promise<T>;
}

async function adoRequest(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await SDK.getAccessToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    let detail = body.trim();
    try {
      const payload = JSON.parse(body) as { message?: unknown };
      if (typeof payload.message === 'string') detail = payload.message;
    } catch {
      // Keep the response text when Azure DevOps does not return JSON.
    }
    const hint = response.status === 401 || response.status === 403
      ? ' Verifique os escopos da extensão e as permissões do usuário no Azure DevOps.'
      : '';
    throw new Error(`Azure DevOps retornou ${response.status}${detail ? `: ${detail.slice(0, 300)}` : '.'}${hint}`);
  }
  return response;
}

export async function listProjects(): Promise<AdoProject[]> {
  const url = `${organizationUrl()}/_apis/projects?$top=1000&stateFilter=wellFormed&api-version=7.1`;
  const result = await adoFetch<AdoList<AdoProject>>(url);
  return (result.value ?? []).sort((a, b) => a.name.localeCompare(b.name));
}

export async function listPipelines(projectId: string): Promise<AdoPipeline[]> {
  const url = `${organizationUrl()}/${encodeURIComponent(projectId)}/_apis/pipelines?api-version=7.1`;
  const result = await adoFetch<AdoList<AdoPipeline>>(url);
  return (result.value ?? []).sort((a, b) => a.name.localeCompare(b.name));
}

export async function listTemplateFolders(providerFolder: string): Promise<{ path: string; name: string }[]> {
  const query = new URLSearchParams({
    scopePath: `/${providerFolder}`,
    recursionLevel: 'OneLevel',
    includeContentMetadata: 'true',
    'versionDescriptor.version': 'main',
    'versionDescriptor.versionType': 'branch',
    'api-version': '7.1',
  });
  const url = `${organizationUrl()}/APPS/_apis/git/repositories/APPS-templates/items?${query}`;
  const result = await adoFetch<GitItemList | GitItem[]>(url);
  const items = Array.isArray(result) ? result : result.value;
  const parentSegments = providerFolder.split('/').filter(Boolean);
  return items.flatMap((item) => {
    if (!item.isFolder) return [];
    const segments = item.path.split('/').filter(Boolean);
    if (segments.length !== parentSegments.length + 1
      || !parentSegments.every((segment, index) => segments[index] === segment)) return [];

    const name = segments[segments.length - 1];
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) return [];
    return [{ path: `/${segments.join('/')}`, name }];
  })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function readTemplateFile(path: string): Promise<string> {
  const query = new URLSearchParams({
    path,
    includeContent: 'true',
    'versionDescriptor.version': 'main',
    'versionDescriptor.versionType': 'branch',
    'api-version': '7.1',
  });
  const url = `${organizationUrl()}/APPS/_apis/git/repositories/APPS-templates/items?${query}`;
  const response = await adoRequest(url);
  const body = await response.text();
  try {
    const item = JSON.parse(body) as { path?: unknown; content?: unknown };
    if (typeof item.path === 'string' && typeof item.content === 'string') return item.content;
  } catch {
    return body;
  }
  return body;
}

export async function runPipeline(
  projectId: string,
  pipelineId: number,
  requestJson: string,
): Promise<PipelineRun> {
  const url = `${organizationUrl()}/${encodeURIComponent(projectId)}/_apis/pipelines/${pipelineId}/runs?api-version=7.1`;
  return adoFetch<PipelineRun>(url, {
    method: 'POST',
    body: JSON.stringify({
      templateParameters: {
        requestJson,
      },
    }),
  });
}

export function runWebUrl(projectId: string, runId: number): string {
  return `${organizationUrl()}/${encodeURIComponent(projectId)}/_build/results?buildId=${runId}&view=results`;
}
