# Arquitetura — CloudHub

## Princípio

Somente frontend instalado como extensão privada do Azure DevOps Services. Não há serviço API, servidor próprio ou banco de dados externo.

## Fluxo

1. O Extension SDK fornece o contexto da organização e o token de acesso.
2. `adoApi.ts` chama as APIs REST oficiais para listar projetos, listar pipelines, ler templates no Azure Repos e enfileirar execuções.
3. O catálogo lê, sob demanda, arquivos JSON do repositório `APPS/APPS-templates`, branch `main`, usando o token da sessão e o escopo `vso.code`. As pastas são `/aws`, `/gcp`, `/atlas` e `/oci`; **Atualizar** busca de novo os templates do provedor selecionado.
4. `template-repository/` contém `aws/globalConfig.json` e, em cada `aws/<resourceType>/`, `parameters.json` para o formulário e `terragrunt.hcl` para a pipeline; os templates não são empacotados na extensão.
5. `config.ts` persiste os projetos habilitados e a URL da pipeline compartilhada usando o Extension Data Service da própria plataforma.
6. O app extrai o projeto e o ID dessa URL, serializa os valores preenchidos na raiz de `requestJson` (sem objeto `parameters`) e envia esse único parâmetro para a API de execução.
7. A pipeline construtora valida `requestJson`, deriva os arquivos pelo provedor e `resourceType`, cria e envia uma branch feature no repositório `self`, e executa `terragrunt plan`. Após aprovação manual, aplica o plano salvo e abre um PR para `main`; o merge continua sujeito às políticas do repositório. O exemplo usa agentes Microsoft-hosted `ubuntu-latest`, instala as versões atuais de Terraform/Terragrunt com checksums e reutiliza as mesmas versões no apply. A autenticação/backend AWS ficam no Terragrunt; a identidade de build precisa de permissões de push e PR.

## APIs REST

- `GET https://dev.azure.com/{organization}/_apis/projects?$top=1000&stateFilter=wellFormed&api-version=7.1`
- `GET https://dev.azure.com/{organization}/APPS/_apis/git/repositories/APPS-templates/items` (listagem e leitura dos JSONs por pasta e branch)
- `POST https://dev.azure.com/{organization}/{projectId}/_apis/pipelines/{pipelineId}/runs?api-version=7.1`

O formulário configura uma única URL de pipeline no escopo da organização. A URL determina o projeto e o ID usados no `POST`.

## Escopos declarados

- `vso.profile`
- `vso.project`
- `vso.code`
- `vso.build_execute`
- `vso.extension_data`
- `vso.extension_data_write`

Revise os escopos e permissões exigidos no ambiente real antes de publicar.

Cada usuário precisa ter permissão de leitura no repositório Azure Repos. Não configure PATs na extensão.

## Limites de segurança

A UI não substitui a autorização da plataforma. O usuário que envia a solicitação precisa ter acesso para executar a pipeline. As permissões de ambientes, service connections, repositórios e recursos permanecem no Azure DevOps. Não coloque PATs ou segredos no frontend.
