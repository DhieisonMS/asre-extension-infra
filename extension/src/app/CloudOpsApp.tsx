import { MessageBar, MessageBarBody, Spinner, Title1 } from '@fluentui/react-components';
import { AdministrationPage } from '../features/administration/AdministrationPage';
import { pipelineFromUrl } from '../features/catalog/catalog';
import { RequestPage } from '../features/requests/RequestPage';
import { useAppStyles } from './appStyles';
import type { AdoContext } from './types';
import { useOrganizationData } from './useOrganizationData';

export default function CloudOpsApp({ adoContext }: { adoContext: AdoContext }) {
  const styles = useAppStyles();
  const contributionId = adoContext.contributionId?.split('.').pop();
  const isSettingsPage = contributionId === 'smart-forms-settings';
  const {
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
  } = useOrganizationData();

  const enabledProjects = projects.filter((project) => config.projects[project.id]?.enabled);
  const currentProjectEnabled = !adoContext.projectId || Boolean(config.projects[adoContext.projectId]?.enabled);
  const pipelineUrl = config.pipelineUrl ?? Object.values(config.projects).find((project) => project.pipelineUrl)?.pipelineUrl ?? '';
  const pipeline = pipelineFromUrl(pipelineUrl);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <Title1>cloudOps</Title1>
          <p className={styles.subtitle}>Solicite recursos de nuvem. Escolha um serviço do catálogo e informe os parâmetros para iniciar a pipeline.</p>
        </div>
        <div className="status-pill"><span className="status-dot" /> Sem backend próprio</div>
      </header>

      {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
      {notice && <MessageBar intent="success"><MessageBarBody>{notice}</MessageBarBody></MessageBar>}

      {loading ? <section className={styles.card}><Spinner label="Carregando dados da organização..." /></section>
        : isSettingsPage ? <AdministrationPage
          projects={projects}
          config={config}
          configReady={configReady}
          saving={saving}
          onProjectEnabled={setProjectEnabled}
          onPipelineUrlChange={setPipelineUrl}
          onSave={() => void persistConfig()}
        />
          : adoContext.projectId && !currentProjectEnabled ? <section className={styles.card}>
            <Title1 as="h2" className={styles.cardTitle}>cloudOps não habilitado</Title1>
            <MessageBar intent="warning"><MessageBarBody>O uso da extensão não foi habilitado para {adoContext.project || 'este projeto'}. Um administrador pode habilitá-lo em Organization settings &gt; CloudOps.</MessageBarBody></MessageBar>
          </section>
            : <RequestPage adoContext={adoContext} enabledProjects={enabledProjects} pipeline={pipeline} />}

      <p className={styles.muted}>As opções e validações do formulário melhoram a experiência, mas não substituem as permissões, aprovações, checks de ambiente e restrições de service connections configuradas no Azure DevOps.</p>
    </main>
  );
}