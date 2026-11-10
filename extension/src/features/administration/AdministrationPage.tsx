import { useState } from 'react';
import { Button, Checkbox, Field, Input, MessageBar, MessageBarBody, Title1 } from '@fluentui/react-components';
import { CheckmarkCircle24Regular } from '@fluentui/react-icons';
import type { AdoProject } from '../../services/adoApi';
import type { SmartFormsConfig } from '../../services/config';
import { pipelineFromUrl } from '../catalog/catalog';
import { useAppStyles } from '../../app/appStyles';

export function AdministrationPage({
  projects,
  config,
  configReady,
  saving,
  onProjectEnabled,
  onPipelineUrlChange,
  onSave,
}: {
  projects: AdoProject[];
  config: SmartFormsConfig;
  configReady: boolean;
  saving: boolean;
  onProjectEnabled: (projectId: string, enabled: boolean) => void;
  onPipelineUrlChange: (url: string) => void;
  onSave: () => void;
}) {
  const styles = useAppStyles();
  const [projectSearch, setProjectSearch] = useState('');
  const enabledProjects = projects.filter((project) => config.projects[project.id]?.enabled);
  const filteredProjects = projects.filter((project) => project.name.toLowerCase().includes(projectSearch.trim().toLowerCase()));
  const pipelineUrl = config.pipelineUrl ?? Object.values(config.projects).find((project) => project.pipelineUrl)?.pipelineUrl ?? '';
  const pipeline = pipelineFromUrl(pipelineUrl);

  return <>
    <section className={styles.card}>
      <Title1 as="h2" className={styles.cardTitle}>1. Projetos autorizados</Title1>
      <p className={styles.subtitle}>Defina em quais projetos os usuários poderão solicitar recursos pelo CloudHub.</p>
      {projects.length === 0 ? <MessageBar intent="warning"><MessageBarBody>Nenhum projeto foi retornado pela API. Verifique o acesso da sua conta e o escopo vso.project.</MessageBarBody></MessageBar> : <>
        <Field label="Filtrar projetos">
          <Input value={projectSearch} onChange={(_, data) => setProjectSearch(data.value)} placeholder="Buscar pelo nome do projeto" className={styles.full} />
        </Field>
        <div className={styles.settingsProjectList}>
          {filteredProjects.map((project) => <div key={project.id} className={styles.settingsProjectItem}>
            <span>{project.name}</span>
            <Checkbox
              checked={Boolean(config.projects[project.id]?.enabled)}
              onChange={(_, data) => onProjectEnabled(project.id, data.checked === true)}
              aria-label={`Ativar projeto ${project.name}`}
              label="Ativo"
            />
          </div>)}
          {filteredProjects.length === 0 && <p className={styles.muted}>Nenhum projeto corresponde à busca.</p>}
        </div>
        <p className={styles.muted}>{enabledProjects.length} projeto(s) autorizado(s).</p>
      </>}
      <div style={{ marginTop: 20 }} className={styles.footer}>
        <p className={styles.muted}>A autorização vale para os formulários deste catálogo.</p>
        <Button appearance="primary" onClick={onSave} disabled={saving || !configReady || projects.length === 0} icon={saving ? undefined : <CheckmarkCircle24Regular />}>{saving ? 'Salvando...' : 'Salvar projetos'}</Button>
      </div>
    </section>

    <section className={styles.card}>
      <Title1 as="h2" className={styles.cardTitle}>2. Pipeline por solicitação</Title1>
      <p className={styles.subtitle}>Configure uma única pipeline no escopo da organização. Ela será usada por todos os templates.</p>
      <Field label="URL da pipeline compartilhada" required validationState={pipelineUrl && !pipeline ? 'error' : 'none'} validationMessage={pipelineUrl && !pipeline ? 'Informe a URL da pipeline com o projeto e o parâmetro definitionId.' : undefined}>
        <Input type="url" value={pipelineUrl} onChange={(_, data) => onPipelineUrlChange(data.value)} placeholder="https://dev.azure.com/org/projeto/_build?definitionId=123" className={styles.full} />
      </Field>
      <div style={{ marginTop: 20 }} className={styles.footer}>
        <p className={styles.muted}>A URL é salva uma vez para a organização, independentemente do projeto aberto.</p>
        <Button appearance="primary" onClick={onSave} disabled={saving || !pipeline || !configReady} icon={saving ? undefined : <CheckmarkCircle24Regular />}>{saving ? 'Salvando...' : 'Salvar pipeline'}</Button>
      </div>
    </section>
  </>;
}