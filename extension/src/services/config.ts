import * as SDK from 'azure-devops-extension-sdk';
import type { IExtensionDataService, IExtensionDataManager } from 'azure-devops-extension-api/Common/CommonServices';

export type ProjectConfig = {
  enabled: boolean;
  pipelineUrl?: string;
  pipelines: Record<string, number | undefined>;
};
export type SmartFormsConfig = { projects: Record<string, ProjectConfig>; pipelineUrl?: string };
export const emptyProjectConfig = (): ProjectConfig => ({ enabled: false, pipelines: {} });

const CONFIG_KEY = 'smart-forms-project-configuration-v1';
const DEFAULT_CONFIG: SmartFormsConfig = { projects: {} };

async function getManager(): Promise<IExtensionDataManager> {
  const service = await SDK.getService<IExtensionDataService>('ms.vss-features.extension-data-service');
  const token = await SDK.getAccessToken();
  return service.getExtensionDataManager(SDK.getExtensionContext().id, token);
}

export async function loadConfig(): Promise<SmartFormsConfig> {
  const manager = await getManager();
  const value = await manager.getValue<SmartFormsConfig>(CONFIG_KEY, {
    scopeType: 'Default',
    scopeValue: 'Current',
    defaultValue: DEFAULT_CONFIG,
  });
  return value ?? DEFAULT_CONFIG;
}

export async function saveConfig(config: SmartFormsConfig): Promise<void> {
  const manager = await getManager();
  await manager.setValue(CONFIG_KEY, config, { scopeType: 'Default', scopeValue: 'Current' });
}
