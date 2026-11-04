import { useEffect, useState } from 'react';
import { listProjects, type AdoProject } from '../services/adoApi';
import { emptyProjectConfig, loadConfig, saveConfig, type SmartFormsConfig } from '../services/config';

export function useOrganizationData() {
  const [projects, setProjects] = useState<AdoProject[]>([]);
  const [config, setConfig] = useState<SmartFormsConfig>({ projects: {} });
  const [configReady, setConfigReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;

    async function initialize() {
      setLoading(true);
      setError('');
      try {
        const [projectsResult, configResult] = await Promise.allSettled([listProjects(), loadConfig()]);
        if (!active) return;
        if (projectsResult.status === 'rejected') throw projectsResult.reason;

        setProjects(projectsResult.value);
        if (configResult.status === 'fulfilled') {
          setConfig(configResult.value);
          setConfigReady(true);
        } else {
          const detail = configResult.reason instanceof Error ? configResult.reason.message : 'erro desconhecido';
          setError(`Os projetos foram carregados, mas não foi possível ler a configuração salva: ${detail}`);
        }
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error
            ? cause.message
            : 'Não foi possível carregar os dados do Azure DevOps. Abra a extensão dentro da organização e verifique suas permissões.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void initialize();
    return () => { active = false; };
  }, []);

  function setProjectEnabled(targetProjectId: string, enabled: boolean) {
    setConfig((current) => ({
      ...current,
      projects: {
        ...current.projects,
        [targetProjectId]: {
          ...emptyProjectConfig(),
          ...(current.projects[targetProjectId] ?? {}),
          enabled,
        },
      },
    }));
  }

  function setPipelineUrl(pipelineUrl: string) {
    setConfig((current) => ({ ...current, pipelineUrl }));
  }

  async function persistConfig() {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await saveConfig(config);
      setConfigReady(true);
      setNotice('Configuração salva na extensão para esta organização.');
    } catch (cause) {
      setError(cause instanceof Error
        ? cause.message
        : 'Não foi possível salvar a configuração. Verifique a permissão de dados da extensão.');
    } finally {
      setSaving(false);
    }
  }

  return {
    projects,
    config,
    configReady,
    loading,
    saving,
    error,
    notice,
    setProjectEnabled,
    setPipelineUrl,
    persistConfig,
  };
}