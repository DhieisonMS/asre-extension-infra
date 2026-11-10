# Estado atual

- Extensão frontend-only para Azure DevOps Services; não há backend nem banco de dados externo.
- As chamadas REST e a persistência usam o token e os serviços da sessão do Azure DevOps.
- O build local foi validado com `npm run build` na pasta `extension`.
- Templates do catálogo e opções do formulário são dados JSON com schemas para validação no editor.
- Antes de disponibilizar amplamente, revise quem pode alterar a configuração compartilhada. A interface administrativa não substitui controles de autorização no Azure DevOps.

## Auditoria de dependências

- `yarn audit --groups dependencies --non-interactive`: sem vulnerabilidades nas dependências de runtime.
- `yarn audit --non-interactive`: um alerta alto permanece em `braces@3.0.3`, dependência transitiva de desenvolvimento do `tfx-cli` (`shelljs > fast-glob > micromatch > braces`). O registry não oferece versão corrigida no momento da auditoria.
- O empacotamento usa um padrão fixo (`vss-extension.json`); não passe padrões ou caminhos não confiáveis ao `tfx-cli`. Reavalie o alerta quando o upstream publicar uma correção.

## Comandos de manutenção

- `npm run build`: verifica TypeScript e gera `dist/`.
- `npm run package`: compila e gera o pacote `.vsix` com `tfx`.
- A pasta `dist/`, dependências, pacotes `.vsix` e arquivos `*.tsbuildinfo` são artefatos locais ignorados pelo Git.
