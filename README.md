# Hub Turismo Amazonas

Site institucional com contato persistente e consulta administrativa. O operador autorizado é configurado por variável de ambiente; o painel exige login e nega acesso a contas fora da lista.

## Acessar a publicação

- Site: https://hub-turismo-amazonas.rogeriolevydesousa.chatgpt.site
- Administração: https://hub-turismo-amazonas.rogeriolevydesousa.chatgpt.site/admin

Publicação inicial confirmada em 28/09/2026. O site está restrito ao proprietário e ao visitante convidado. Entre com a conta ChatGPT correspondente ao e-mail autorizado para consultar as mensagens em /admin. A permissão de visitante do site e a autorização administrativa da aplicação são controles separados.

O painel permite consultar, atualizar a lista, paginar e abrir o e-mail do contato para resposta manual. Não envia respostas nem notificações automaticamente. Os dados de teste locais não foram transferidos para produção.

O endereço usado no sitemap e nos metadados está centralizado em lib/site-config.ts. Atualize-o e publique uma nova versão se o domínio mudar.

## Executar localmente

Requisitos: Node.js 22.13+ (testado com 22.23.2) e npm.

1. npm run install:ci
2. npm run build
3. npm run db:migrate:local
4. npm run dev

Abra a URL informada pelo servidor, normalmente http://127.0.0.1:5173.
Copie .env.example para .dev.vars para configurar o ambiente local.
Para testar administração SOMENTE no ambiente local, use ADMIN_EMAILS="seedy@sites.test" em .dev.vars, reinicie e acesse /admin. O starter simula esse login apenas no desenvolvimento. Produção usa conta real e ambiente Sites.
O script db:migrate:local registra as migrations aplicadas; não execute o SQL repetidamente à mão.

## Verificar e manter

- npm test
- npm run typecheck
- npm run lint
- npm run format:check
- npm run build
- npm run test:smoke (servidor ativo e banco migrado)

TEST_BASE_URL permite outro endereço de teste.
npm run format formata o código.
npm run db:generate cria migrations após alterações no esquema; sempre revise o SQL.

## Rotas

/: institucional e contato; /privacidade: aviso; /admin: mensagens.
APIs: POST /api/contatos, GET /api/admin/contatos, GET /api/health, GET /api/openapi.
O formulário grava dados; não dispara e-mail automático. A equipe retorna manualmente pelo e-mail do visitante.

## Banco e configuração

Cloudflare D1/SQLite, binding DB em .openai/hosting.json. Banco local em .wrangler/state, separado da produção.
ADMIN_EMAILS contém e-mails exatos separados por vírgula. Vazio nega todos. Nunca usar NEXT_PUBLIC_ para esse valor.
Credenciais, ambiente privado e banco local não são versionados.

## Documentação

- docs/ANALISE-E-ARQUITETURA.md: 8 páginas da referência, requisitos, arquitetura, 25 etapas.
- docs/openapi.json: contrato HTTP.
- docs/DEPLOY.md: CI/CD, publicação e recuperação.
- docs/VERIFICACAO.md: evidências e limites.
- docs/IDENTIDADE.md: marca e créditos.
  Os PDFs originais permanecem na pasta superior.
