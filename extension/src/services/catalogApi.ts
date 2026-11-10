import { listTemplateFolders, readTemplateFile } from './adoApi';
import { parseCatalogTemplates, type CloudProvider, type FormDefinition } from '../features/catalog/catalog';

const providerFolders: Record<CloudProvider, string> = {
  aws: 'aws',
  gcp: 'gcp',
  mongodbatlas: 'atlas',
  oracle: 'oci',
};

export async function loadCatalogTemplates(provider: CloudProvider): Promise<FormDefinition[]> {
  const folders = await listTemplateFolders(providerFolders[provider]);
  const contents = await Promise.all(folders.map(async (folder) => {
    const path = `${folder.path}/parameters.json`;
    try {
      return { name: folder.name, content: await readTemplateFile(path) };
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'erro desconhecido';
      throw new Error(`Não foi possível ler "${path}" no repositório de templates. ${detail}`);
    }
  }));
  const templates = parseCatalogTemplates(contents, provider);
  const folderNames = folders.map((folder) => folder.name);
  const templateIds = templates.map((template) => template.id);
  if (new Set(templateIds).size !== templateIds.length
    || folderNames.length !== templateIds.length
    || folderNames.some((folderName) => !templateIds.includes(folderName))) {
    throw new Error('O ID de cada parameters.json precisa corresponder ao nome único da pasta do recurso.');
  }
  return templates;
}
