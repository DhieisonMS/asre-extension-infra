# CloudHub — Azure DevOps Services Extension

Extensão privada de frontend para criar formulários dinâmicos e disparar Azure Pipelines diretamente pelas APIs REST nativas do Azure DevOps Services. **Não possui backend próprio, API FastAPI ou banco de dados externo.**

## O que inclui

- React + TypeScript + Fluent UI.
- Azure DevOps Extension SDK para contexto da sessão.
- REST APIs nativas para listar projetos, ler templates do Azure Repos, listar pipelines e enfileirar execuções.
- Configuração por organização usando o Extension Data Service nativo do Azure DevOps.
- Tela de administração para habilitar projetos e configurar uma pipeline compartilhada pela organização.
- Campos condicionais, validação básica e link para a execução iniciada.

## Pré-requisitos

- Node.js 20+ e npm.
- Organização no Azure DevOps Services.
- Permissão para instalar/extender a organização e configurar permissões de pipelines.
- Um publisher do Visual Studio Marketplace para empacotar e publicar a extensão.

## Executar localmente

```bash
cd extension
npm install
npm run dev
```

A chamada às APIs do Azure DevOps exige que a extensão seja executada no contexto autenticado do Azure DevOps. O modo standalone do Vite não tem o host nem os tokens do Azure DevOps e, portanto, não consegue listar projetos, salvar configurações nem enfileirar pipelines.

## Configurar e empacotar

1. Edite `extension/vss-extension.json` e substitua `YOUR_PUBLISHER_ID` pelo ID real do publisher.
2. Revise os escopos declarados no manifesto. O pacote solicita acesso de leitura a projetos, execução de pipelines e leitura/escrita de dados da extensão.
3. Execute:

```bash
cd extension
npm install
npm run build
npx tfx-cli extension create --manifest-globs vss-extension.json
```

O pacote `.vsix` será criado no diretório da extensão. Publique-o como extensão privada no Visual Studio Marketplace e compartilhe-o com a organização.

## Como funciona a configuração por projeto

- A extensão consulta os projetos disponíveis ao usuário autenticado.
- Na aba **Configurar projetos**, um administrador habilita os projetos e configura uma URL de pipeline compartilhada no escopo da organização.
- A configuração é armazenada no Extension Data Service no escopo da organização.
- A tela de solicitação mostra apenas projetos habilitados e chama a API `Pipelines - Run Pipeline` para a pipeline configurada.

## Importante sobre segurança

- Não há PAT, segredo ou credencial privilegiada no frontend.
- As chamadas usam `SDK.getAccessToken()` e as permissões do usuário conectado.
- O usuário precisa ter permissão para consultar os projetos/pipelines e enfileirar a pipeline selecionada.
- O manifesto solicita `vso.extension_data_write` para salvar configurações. Restrinja a gestão da extensão e valide quem pode administrar a configuração antes de uso corporativo.
- A tela administrativa só é renderizada no contribution `smart-forms-settings`, identificado pelo Extension SDK. Isso organiza a navegação, mas não substitui permissões do Azure DevOps para alterar dados ou executar pipelines.
- Ocultar um projeto ou campo na interface não é uma barreira de segurança. A autorização real deve ser garantida pelo Azure DevOps, incluindo permissões de pipeline, checks de ambientes, permissões de service connection e validação de parâmetros no YAML.
- O frontend não deve ser usado para guardar segredos ou decidir sozinho se uma execução de produção está autorizada.

## Estrutura

```text
extension/
├── src/
│   ├── app/                 # composição, contexto, estado e providers
│   │   └── providers/       # FluentProvider e tema do Azure DevOps
│   ├── features/
│   │   ├── catalog/         # modelos e validação dos templates JSON remotos
│   │   ├── requests/        # fluxo de solicitação de recursos
│   │   └── administration/  # habilitação de projetos e pipeline global
│   ├── services/            # APIs Azure DevOps e persistência de configuração
│   ├── main.tsx             # inicialização do Extension SDK e tema
│   └── styles.css
├── vss-extension.json
├── package.json
└── vite.config.ts
```

A pipeline configurada na organização deve declarar o parâmetro string `requestJson`. O exemplo em `docs/pipeline-example.yml` valida o pedido AWS, exibe os dados principais, cria uma branch `feature/YYYYMM/add-<tipo>-<nome>-<ambiente>` no repositório `self`, cria os arquivos de infraestrutura, executa `terragrunt plan`, aguarda aprovação manual antes do `terragrunt apply` e então abre um PR para `main`. Ele falha se a estrutura já existir em `main` ou se o template do recurso estiver ausente; não faz merge automático do PR.

## Manutenção do catálogo e opções

Os templates são lidos sob demanda do repositório Azure Repos `APPS/APPS-templates`, branch `main`; a aba AWS lê `/aws`, GCP lê `/gcp`, MongoDB Atlas lê `/atlas`, e Oracle lê `/oci`. O botão **Atualizar** consulta novamente a pasta da aba selecionada, sem exigir uma nova publicação da extensão. A extensão usa o token da sessão Azure DevOps e requer o escopo `vso.code` e permissão de leitura no repositório para o usuário.

Os arquivos prontos para publicar no Azure Repos estão em [template-repository/](./template-repository/). Copie o conteúdo dessa pasta para a raiz do `APPS-templates`; ela contém o schema, a configuração global AWS, as pastas dos provedores e os arquivos por recurso. A extensão lista pastas de recursos diretamente em `aws/`, `gcp/`, `atlas/` ou `oci/` e carrega `parameters.json` dentro de cada pasta. Esse arquivo define o formulário; `terragrunt.hcl` na mesma pasta é usado pela pipeline. O `id` do formulário deve corresponder ao nome da pasta, por exemplo `aws/alb/parameters.json` com `"id": "alb"`.

Mantenha os formulários `parameters.json` no formato abaixo, dentro da pasta do recurso. Para validação e autocomplete no editor, mantenha também `catalog.schema.json` na raiz do repositório, referenciado por `$schema` como `../../catalog.schema.json`. Um novo recurso ou categoria aparece automaticamente após **Atualizar**.

Exemplo de `criacao-eks.json`:

```json
{
	"id": "criacao-eks",
	"provider": "aws",
	"title": "Cluster EKS",
	"description": "Solicite um cluster Kubernetes gerenciado.",
	"category": "Computação",
	"resourceLabel": "Nome do cluster",
	"resourcePlaceholder": "ex.: pagamentos-eks",
	"icon": "compute",
	"fields": [
		{ "name": "kubernetesVersion", "label": "Versão do Kubernetes", "placeholder": "ex.: 1.31", "required": true },
		{ "name": "nodeCount", "label": "Quantidade de nodes", "type": "number", "placeholder": "ex.: 3", "required": true }
	]
}
```

Os campos aceitam `text`, `number`, `textarea` e `select`; campos obrigatórios usam `required: true`, e opções de seleção são declaradas em `options`. Para regras de nome, use `resourceNameValidation`; para gerar um nome final, use `resourceNameTemplate`, com os marcadores `{resourceName}` e `{environment}`. Os ícones disponíveis são `kubernetes`, `database`, `topic`, `compute`, `network` e `security`; para adicionar outro, registre-o em `catalog.tsx`.

Opcionalmente, cada campo pode declarar `valueType` como `string`, `number`, `boolean`, `string[]` ou `json` para definir o tipo enviado na raiz de `requestJson`. Campos `number` já são serializados como número; listas podem ser inseridas separadas por vírgula ou quebra de linha, e `json` precisa ser um objeto ou array JSON válido.

Ao enviar uma solicitação, a extensão serializa um único parâmetro `requestJson`, com os campos do recurso diretamente na raiz e sem objeto `parameters`. Para AWS, o payload inclui `accountDomain`, `accountAwsName`, `accountAwsId`, VPC e subnets do domínio/ambiente selecionados, além do nome, ambiente, região e justificativa. O campo de formulário `vpcId` corresponde ao campo padrão da solicitação; `subnetIds` é convertido para o campo padrão `subnets`. A pipeline deve validar esses valores contra `globalConfig.json`. Números são enviados como números, campos marcados `valueType: "string[]"` como arrays e campos `valueType: "json"` como JSON estruturado. O exemplo está em `template-repository/request-example.json`.

A pipeline deriva os arquivos apenas dos campos validados do request, sem aceitar caminhos de arquivo do cliente. Para AWS, gera `aws/<accountDomain>/<resourceType>/<resourceName>/terragrunt.hcl` copiando `aws/<resourceType>/terragrunt.hcl` do repositório de templates, e `env/<environment>.tfvars` com os campos do JSON na raiz, exceto `provider`, `resourceType`, `schemaVersion`, `templateId` e `accountDomain`. O request identifica um único ambiente.

O exemplo usa agentes Microsoft-hosted `ubuntu-latest`. O script `docs/install-iac-tools.sh` baixa as versões estáveis mais recentes de Terraform e Terragrunt e verifica os checksums; a etapa de apply reinstala exatamente as mesmas versões resolvidas na etapa de plan. O Terragrunt do recurso deve configurar a autenticação AWS e o backend/state sem credenciais hardcoded. A identidade de build precisa de permissão de contribuição no repositório `self`, permissão para criar PR e acesso ao token OAuth (`System.AccessToken`) nos scripts. O apply só ocorre após aprovação na tarefa `ManualValidation`; o plano salvo é publicado como artefato e pode conter valores sensíveis. Os erros imprimem o `requestJson` nos logs para permitir uma execução manual: não envie segredos no formulário e restrinja o acesso e a retenção dos logs/artefatos.

As contas AWS, os IDs, VPCs, regiões, subnets e ambientes disponíveis são carregados de `aws/globalConfig.json` no repositório remoto de templates. Para alterar essas opções, atualize esse arquivo no Azure Repos; não é necessário alterar nem publicar novamente a extensão. Consulte o exemplo e o schema em `template-repository/aws/`.
