import { useEffect, useState } from 'react';
import {
  Button, Field, Input, MessageBar, MessageBarBody, Select, Spinner, Textarea, Title1,
} from '@fluentui/react-components';
import {
  AppsListDetail24Regular, ArrowSync24Regular, ArrowUpload24Regular, CheckmarkCircle24Regular, Database24Regular,
  DocumentBulletList24Regular, Globe24Regular, Search24Regular, Server24Regular,
} from '@fluentui/react-icons';
import { runPipeline, runWebUrl, type AdoProject } from '../../services/adoApi';
import { loadCatalogTemplates } from '../../services/catalogApi';
import { loadAwsGlobalConfig, type AwsDomainConfig, type AwsEnvironmentConfig, type AwsGlobalConfig } from '../../services/awsConfig';
import { buildProvisioningRequest, buildResourceName, categoriesForProvider, cloudProviders, type CloudProvider, type FormDefinition } from '../catalog/catalog';
import { useAppStyles } from '../../app/appStyles';

type PipelineReference = { id: number; project: string };

function selectedFormDefaults(form?: FormDefinition, environment?: AwsEnvironmentConfig): Record<string, string> {
  if (!form || !environment) return {};
  return Object.fromEntries(form.fields
    .flatMap((field) => {
      if (field.name === 'subnetIds' && field.valueType === 'string[]') {
        return [[field.name, environment.subnets.join(', ')]];
      }
      if (field.name === 'vpcId') return [[field.name, environment.vpcId]];
      return [];
    }));
}

export function RequestPage({ enabledProjects, pipeline }: {
  enabledProjects: AdoProject[];
  pipeline?: PipelineReference;
}) {
  const styles = useAppStyles();
  const [formId, setFormId] = useState('');
  const [provider, setProvider] = useState<CloudProvider>('aws');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [catalog, setCatalog] = useState<FormDefinition[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [extraParameters, setExtraParameters] = useState<Record<string, string>>({});
  const [awsConfig, setAwsConfig] = useState<AwsGlobalConfig>();
  const [awsDomainName, setAwsDomainName] = useState('');
  const [selectedEnvironment, setSelectedEnvironment] = useState('');
  const [resourceName, setResourceName] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<{ intent: 'success' | 'error'; message: string; url?: string } | null>(null);

  useEffect(() => {
    let active = true;
    if (enabledProjects.length === 0) {
      setCatalogLoading(false);
      return () => { active = false; };
    }

    setCatalogLoading(true);
    setCatalogError('');
    void Promise.all([
      loadCatalogTemplates(provider),
      provider === 'aws' ? loadAwsGlobalConfig() : Promise.resolve(undefined),
    ])
      .then(([loadedCatalog, loadedAwsConfig]) => {
        if (!active) return;
        setCatalog(loadedCatalog);
        if (loadedAwsConfig) setAwsConfig(loadedAwsConfig);
      })
      .catch((cause: unknown) => {
        if (active) setCatalogError(cause instanceof Error ? cause.message : 'Não foi possível carregar o catálogo do repositório.');
      })
      .finally(() => {
        if (active) setCatalogLoading(false);
      });

    return () => { active = false; };
  }, [provider, catalogRevision, enabledProjects.length]);

  const providerForms = catalog.filter((form) => form.provider === provider);
  const categories = categoriesForProvider(provider, catalog);
  const selectedForm = providerForms.find((form) => form.id === formId);
  const selectedDomain: AwsDomainConfig | undefined = awsConfig?.domains.find((domain) => domain.accountName === awsDomainName)
    ?? awsConfig?.domains[0];
  const environments = selectedDomain ? ['hml', 'uat', 'prd'].filter((name) => name in selectedDomain.environments) : [];
  const environment = environments.includes(selectedEnvironment) ? selectedEnvironment : environments[0] ?? '';
  const environmentConfig: AwsEnvironmentConfig | undefined = selectedDomain?.environments[environment];
  const regions = environmentConfig?.regions ?? [];
  const region = regions.includes(selectedRegion) ? selectedRegion : regions[0] ?? '';
  const accountAwsName = selectedDomain && environment ? `${selectedDomain.accountName}-${environment}` : '';
  const visibleForms = providerForms.filter((form) => (!category || form.category === category)
    && `${form.title} ${form.description} ${form.category}`.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR')));
  const normalizedResourceName = resourceName.trim();
  const nameValidation = selectedForm?.resourceNameValidation;
  const validName = normalizedResourceName.length > 0
    && normalizedResourceName.length <= (nameValidation?.maxLength ?? 128)
    && (!nameValidation?.pattern || new RegExp(nameValidation.pattern).test(normalizedResourceName));
  const validExtraParameters = selectedForm?.fields
    .filter((field) => field.required)
    .every((field) => Boolean(extraParameters[field.name]?.trim())) && Boolean(accountAwsName && environmentConfig && region);
  const requestResourceName = selectedForm ? buildResourceName(selectedForm, resourceName, environment) : resourceName.trim();

  async function submitRequest() {
    setError('');
    setFeedback(null);
    if (!selectedForm || !pipeline || !validName || !validExtraParameters || !justification.trim()
      || !selectedDomain || !environmentConfig || !region) {
      setError('Escolha um item do catálogo e preencha os campos obrigatórios antes de enviar.');
      return;
    }
    if (environment === 'prd' && !window.confirm('Você selecionou produção. Deseja realmente enfileirar esta pipeline?')) return;

    let requestJson: string;
    try {
      requestJson = JSON.stringify(buildProvisioningRequest(selectedForm, extraParameters, {
        accountDomain: selectedDomain.accountName,
        accountAwsName,
        accountAwsId: environmentConfig.accountId,
        vpcId: environmentConfig.vpcId,
        resourceName: requestResourceName,
        environment,
        region,
        subnets: environmentConfig.subnets,
        justification: justification.trim(),
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Confira os parâmetros informados no formulário.');
      return;
    }

    setSubmitting(true);
    try {
      const run = await runPipeline(pipeline.project, pipeline.id, requestJson);
      setFeedback({
        intent: 'success',
        message: `Pipeline acionada com sucesso. Execução #${run.id}.`,
        url: runWebUrl(pipeline.project, run.id),
      });
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'Verifique as permissões do usuário e os parâmetros enviados.';
      setFeedback({ intent: 'error', message: `Falha ao acionar a pipeline. ${detail}` });
    } finally {
      setSubmitting(false);
    }
  }

  return <>
    <div className={selectedForm && enabledProjects.length > 0 ? styles.requestWorkspaceWithForm : styles.requestWorkspace}>
    <section className={`${styles.catalogPanel} ${selectedForm ? styles.catalogPanelCompact : ''}`}>
      <header className={styles.catalogPanelHeader}>
        <Title1 as="h2" className={styles.catalogPanelTitle}>Catálogo de infraestrutura</Title1>
        <div className={styles.providerTabs} role="group" aria-label="Provedor de nuvem">
          {cloudProviders.map((item) => <Button
            key={item.id}
            size="small"
            aria-pressed={provider === item.id}
            appearance={provider === item.id ? 'primary' : 'subtle'}
            onClick={() => {
              setProvider(item.id);
              setCategory('');
              setFormId('');
              setResourceName('');
              setExtraParameters({});
              setAwsDomainName('');
              setSelectedEnvironment('');
              setSelectedRegion('');
              setAwsConfig(undefined);
              setSearch('');
              setError('');
              setFeedback(null);
            }}
          >{item.label}</Button>)}
        </div>
      </header>
      {enabledProjects.length === 0 ? <MessageBar intent="warning"><MessageBarBody>Nenhum projeto foi habilitado. A equipe administradora pode habilitar projetos em Organization settings.</MessageBarBody></MessageBar> : <>
        <div className={styles.catalogBody}>
          <nav className={styles.categorySidebar} aria-label="Categorias">
            <div className={styles.sidebarHeading}>CATEGORIAS</div>
            <button type="button" aria-current={!category ? 'true' : undefined} className={styles.sidebarCategory} onClick={() => setCategory('')}>
              <AppsListDetail24Regular />
              <span>Todas</span>
              <span className={styles.categoryCount}>{providerForms.length}</span>
            </button>
            {categories.map((item) => {
              const count = providerForms.filter((form) => form.category === item).length;
              const CategoryIcon = /dados|banco/i.test(item) ? Database24Regular
                : /computa|plataforma/i.test(item) ? Server24Regular
                  : /rede/i.test(item) ? Globe24Regular
                    : /mensageria/i.test(item) ? DocumentBulletList24Regular
                      : AppsListDetail24Regular;
              return <button
                key={item}
                type="button"
                aria-current={category === item ? 'true' : undefined}
                className={styles.sidebarCategory}
                onClick={() => setCategory(item)}
              >
                <CategoryIcon />
                <span>{item}</span>
                <span className={styles.categoryCount}>{count}</span>
              </button>;
            })}
          </nav>
          <div className={styles.catalogContent}>
            {catalogError && <MessageBar intent="error"><MessageBarBody>{catalogError}</MessageBarBody></MessageBar>}
            <div className={styles.catalogToolbar}>
              {providerForms.length > 0 && <div className={styles.catalogSearch}>
                <Search24Regular />
                <Input
                  value={search}
                  onChange={(_, data) => setSearch(data.value)}
                  placeholder="Buscar serviço..."
                  aria-label="Buscar serviço no catálogo"
                  appearance="underline"
                />
              </div>}
              <Button
                appearance="subtle"
                icon={<ArrowSync24Regular />}
                onClick={() => {
                  setCategory('');
                  setCatalogRevision((revision) => revision + 1);
                }}
                disabled={catalogLoading}
              >Atualizar</Button>
            </div>
            {catalogLoading && providerForms.length === 0 ? <div className={styles.emptyCatalog} role="status">
              <Spinner label="Carregando templates do repositório..." />
            </div> : providerForms.length === 0 ? <div className={styles.emptyCatalog} aria-live="polite">
              {catalogError
                ? 'Não foi possível carregar os templates. Corrija o acesso ou tente atualizar novamente.'
                : `Ainda não há templates cadastrados para ${cloudProviders.find((item) => item.id === provider)?.label}.`}
            </div> : <>
              {providerForms.length > 0 && visibleForms.length === 0 ? <div className={styles.emptyCatalog} aria-live="polite">Nenhum serviço encontrado com os filtros atuais.</div> : <div className={styles.catalogGrid}>
                {visibleForms.map((form) => <button
                  key={form.id}
                  type="button"
                  aria-pressed={formId === form.id}
                  className={`${styles.catalogItem} ${formId === form.id ? styles.catalogItemSelected : ''}`}
                  onClick={() => {
                    setFormId(form.id);
                    setResourceName('');
                    setExtraParameters(selectedFormDefaults(form, environmentConfig));
                    setError('');
                  }}
                >
                  <span className={styles.catalogIcon}>{form.icon}</span>
                  <span className={styles.catalogTitle}>{form.title}</span>
                  <span className={styles.catalogDescription}>{form.description}</span>
                </button>)}
              </div>}
            </>}
          </div>
        </div>
      </>}
    </section>

    {selectedForm && enabledProjects.length > 0 && <section className={`${styles.card} ${styles.workspaceCard}`}>
      <header className={styles.selectedResource}>
        <span className={styles.catalogIcon}>{selectedForm.icon}</span>
        <div>
          <Title1 as="h2" className={styles.selectedResourceTitle}>{selectedForm.title}</Title1>
          <p className={styles.subtitle}>{selectedForm.description} Informe os parâmetros para abrir uma execução.</p>
        </div>
      </header>
      <div className={styles.grid}>
        <Field label="Domínio AWS" required>
          <Select value={selectedDomain?.accountName ?? ''} onChange={(_, data) => {
            setAwsDomainName(data.value);
            setSelectedEnvironment('');
            setSelectedRegion('');
            const domain = awsConfig?.domains.find((item) => item.accountName === data.value);
            setExtraParameters(selectedFormDefaults(selectedForm, domain?.environments.hml));
          }} className={styles.full}>
            <option value="">Selecione um domínio AWS</option>
            {awsConfig?.domains.map((domain) => <option key={domain.accountName} value={domain.accountName}>{domain.accountName}</option>)}
          </Select>
        </Field>
        <Field label="Ambiente" required>
          <Select value={environment} onChange={(_, data) => {
            setSelectedEnvironment(data.value);
            setSelectedRegion('');
            setExtraParameters(selectedFormDefaults(selectedForm, selectedDomain?.environments[data.value]));
          }} className={styles.full} disabled={!selectedDomain}>
            {environments.map((name) => <option key={name} value={name}>{name.toUpperCase()}</option>)}
          </Select>
        </Field>
        <Field label="Região AWS" required>
          <Select value={region} onChange={(_, data) => setSelectedRegion(data.value)} className={styles.full} disabled={!environmentConfig}>
            {regions.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
        </Field>
        <Field label={selectedForm.resourceLabel} required validationState={resourceName && !validName ? 'error' : 'none'} validationMessage={resourceName && !validName ? selectedForm.resourceNameValidation?.message ?? 'Informe um nome com até 128 caracteres.' : undefined}>
          <Input value={resourceName} onChange={(_, data) => setResourceName(data.value)} placeholder={selectedForm.resourcePlaceholder} className={styles.full} />
        </Field>
        {selectedForm.generatedResourceNameLabel && <Field label={selectedForm.generatedResourceNameLabel}>
          <Input value={requestResourceName} readOnly className={styles.full} />
        </Field>}
        {selectedForm.fields.map((field) => <Field key={field.name} label={field.label} required={field.required}>
          {field.type === 'textarea' ? <Textarea value={extraParameters[field.name] ?? ''} onChange={(_, data) => setExtraParameters((current) => ({ ...current, [field.name]: data.value }))} placeholder={field.placeholder} resize="vertical" className={styles.full} />
            : field.type === 'select' ? <Select value={extraParameters[field.name] ?? ''} onChange={(_, data) => setExtraParameters((current) => ({ ...current, [field.name]: data.value }))} className={styles.full}>
              <option value="">Selecione uma opção</option>
              {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
              : <Input type={field.type === 'number' ? 'number' : 'text'} value={extraParameters[field.name] ?? ''} onChange={(_, data) => setExtraParameters((current) => ({ ...current, [field.name]: data.value }))} placeholder={field.placeholder} className={styles.full} />}
        </Field>)}
        <Field label="Pipeline associada" required>
          <Input value={pipeline ? `${pipeline.project} · pipeline #${pipeline.id}` : 'Pipeline da organização não configurada'} readOnly className={styles.full} />
        </Field>
      </div>
      <div className={styles.justification}>
        <Field label="Justificativa" required><Textarea value={justification} onChange={(_, data) => setJustification(data.value)} placeholder="Explique a finalidade da solicitação..." resize="vertical" className={styles.full} /></Field>
      </div>
      {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
      <div className={`${styles.requestActions} ${styles.footer}`}>
        <div><strong>Execução autenticada</strong><p className={styles.muted}>A chamada REST utiliza o token da sessão. O Azure DevOps aplica as permissões do usuário e as regras da pipeline.</p></div>
        <Button appearance="primary" icon={submitting ? undefined : <ArrowUpload24Regular />} onClick={() => void submitRequest()} disabled={submitting || !pipeline || !validName || !validExtraParameters || !justification.trim()}>{submitting ? 'Enfileirando...' : 'Enviar solicitação'}</Button>
      </div>
      {feedback && <MessageBar intent={feedback.intent} icon={feedback.intent === 'success' ? <CheckmarkCircle24Regular /> : undefined}>
        <MessageBarBody>{feedback.message}{feedback.url && <> — <a href={feedback.url} target="_blank" rel="noreferrer">Abrir execução</a></>}</MessageBarBody>
      </MessageBar>}
    </section>}
    </div>
  </>;
}