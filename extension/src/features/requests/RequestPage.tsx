import { useState } from 'react';
import {
  Button, Field, Input, MessageBar, MessageBarBody, Select, Textarea, Title1,
} from '@fluentui/react-components';
import { ArrowUpload24Regular, CheckmarkCircle24Regular, ShieldCheckmark24Regular } from '@fluentui/react-icons';
import { runPipeline, runWebUrl, type AdoProject } from '../../services/adoApi';
import type { AdoContext } from '../../app/types';
import { buildResourceName, categories, forms } from '../catalog/catalog';
import requestOptions from './request-options.json';
import { useAppStyles } from '../../app/appStyles';

type PipelineReference = { id: number; project: string };

export function RequestPage({ adoContext, enabledProjects, pipeline }: {
  adoContext: AdoContext;
  enabledProjects: AdoProject[];
  pipeline?: PipelineReference;
}) {
  const styles = useAppStyles();
  const [formId, setFormId] = useState('');
  const [category, setCategory] = useState(forms[0].category);
  const [extraParameters, setExtraParameters] = useState<Record<string, string>>({});
  const [awsAccountName, setAwsAccountName] = useState('');
  const [environment, setEnvironment] = useState(requestOptions.defaultEnvironment);
  const [resourceName, setResourceName] = useState('');
  const [region, setRegion] = useState(requestOptions.defaultRegion);
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<{ intent: 'success' | 'error'; message: string; url?: string } | null>(null);

  const selectedForm = forms.find((form) => form.id === formId);
  const categoryForms = forms.filter((form) => form.category === category);
  const normalizedResourceName = resourceName.trim();
  const nameValidation = selectedForm?.resourceNameValidation;
  const validName = normalizedResourceName.length > 0
    && normalizedResourceName.length <= (nameValidation?.maxLength ?? 128)
    && (!nameValidation?.pattern || new RegExp(nameValidation.pattern).test(normalizedResourceName));
  const validExtraParameters = selectedForm?.fields
    .filter((field) => field.required)
    .every((field) => Boolean(extraParameters[field.name]?.trim())) && Boolean(awsAccountName);
  const requestResourceName = selectedForm ? buildResourceName(selectedForm, resourceName, environment) : resourceName.trim();

  async function submitRequest() {
    setError('');
    setFeedback(null);
    if (!selectedForm || !pipeline || !validName || !validExtraParameters || !justification.trim()) {
      setError('Escolha um item do catálogo e preencha os campos obrigatórios antes de enviar.');
      return;
    }
    if (environment === 'prd' && !window.confirm('Você selecionou produção. Deseja realmente enfileirar esta pipeline?')) return;

    setSubmitting(true);
    try {
      const run = await runPipeline(pipeline.project, pipeline.id, {
        template: formId,
        environment,
        resourceName: requestResourceName,
        justification,
        region,
        additionalParameters: { ...extraParameters, accountAwsName: `${awsAccountName}-${environment}` },
      });
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
    <section className={styles.card}>
      <Title1 as="h2" className={styles.cardTitle}>Solicitante</Title1>
      <div className={styles.identity}>
        <ShieldCheckmark24Regular className={styles.identityIcon} />
        <div>
          <strong>{adoContext.userName || 'Usuário autenticado no Azure DevOps'}</strong>
          <div className={styles.muted}>{adoContext.organization ? `Organização: ${adoContext.organization}` : 'Contexto obtido pela sessão do Azure DevOps.'}</div>
        </div>
      </div>
    </section>

    <section className={styles.card}>
      <Title1 as="h2" className={styles.cardTitle}>Catálogo de infraestrutura</Title1>
      <p className={styles.subtitle}>Escolha o recurso que precisa. Os campos e a pipeline correspondentes aparecem em seguida.</p>
      {enabledProjects.length === 0 ? <MessageBar intent="warning"><MessageBarBody>Nenhum projeto foi habilitado. A equipe administradora pode habilitar projetos em Organization settings.</MessageBarBody></MessageBar> : <>
        <div className={styles.categories} aria-label="Categorias do catálogo">
          {categories.map((item) => <Button key={item} appearance={category === item ? 'primary' : 'secondary'} onClick={() => setCategory(item)}>{item}</Button>)}
        </div>
        <div className={styles.catalogGrid}>
          {categoryForms.map((form) => <button
            key={form.id}
            type="button"
            aria-pressed={formId === form.id}
            className={`${styles.catalogItem} ${formId === form.id ? styles.catalogItemSelected : ''}`}
            onClick={() => { setFormId(form.id); setResourceName(''); setExtraParameters({}); setAwsAccountName(''); setError(''); }}
          >
            <span className={styles.catalogIcon}>{form.icon}</span>
            <span className={styles.catalogTitle}>{form.title}</span>
            <span className={styles.catalogDescription}>{form.description}</span>
          </button>)}
        </div>
      </>}
    </section>

    {selectedForm && enabledProjects.length > 0 && <section className={styles.card}>
      <header className={styles.selectedResource}>
        <span className={styles.catalogIcon}>{selectedForm.icon}</span>
        <div>
          <Title1 as="h2" className={styles.cardTitle}>{selectedForm.title}</Title1>
          <p className={styles.subtitle}>{selectedForm.description} Informe os parâmetros para abrir uma execução.</p>
        </div>
      </header>
      <div className={styles.grid}>
        <Field label="Account AWS name" required>
          <Select value={awsAccountName} onChange={(_, data) => setAwsAccountName(data.value)} className={styles.full}>
            <option value="">Selecione uma conta AWS</option>
            {requestOptions.accountNames.map((name) => <option key={name} value={name}>{name}-{environment}</option>)}
          </Select>
        </Field>
        <Field label="Região AWS" required>
          <Select value={region} onChange={(_, data) => setRegion(data.value)} className={styles.full}>
            {requestOptions.regions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
        </Field>
        <Field label="Ambiente" required>
          <Select value={environment} onChange={(_, data) => setEnvironment(data.value)} className={styles.full}>
            {requestOptions.environments.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
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
      <div style={{ marginTop: 16 }}>
        <Field label="Justificativa" required><Textarea value={justification} onChange={(_, data) => setJustification(data.value)} placeholder="Explique a finalidade da solicitação..." resize="vertical" className={styles.full} /></Field>
      </div>
      {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
      <div style={{ marginTop: 18 }} className={styles.footer}>
        <div><strong>Execução autenticada</strong><p className={styles.muted}>A chamada REST utiliza o token da sessão. O Azure DevOps aplica as permissões do usuário e as regras da pipeline.</p></div>
        <Button appearance="primary" icon={submitting ? undefined : <ArrowUpload24Regular />} onClick={() => void submitRequest()} disabled={submitting || !pipeline || !validName || !validExtraParameters || !justification.trim()}>{submitting ? 'Enfileirando...' : 'Enviar solicitação'}</Button>
      </div>
      {feedback && <MessageBar intent={feedback.intent} icon={feedback.intent === 'success' ? <CheckmarkCircle24Regular /> : undefined}>
        <MessageBarBody>{feedback.message}{feedback.url && <> — <a href={feedback.url} target="_blank" rel="noreferrer">Abrir execução</a></>}</MessageBarBody>
      </MessageBar>}
    </section>}
  </>;
}