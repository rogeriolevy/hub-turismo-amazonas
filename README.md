# Hub Turismo Amazonas — versão Node.js + SQLite

Site institucional, diretórios de hospedagens, gastronomia, experiências, agências e serviços turísticos do Amazonas, navegação, contas de turistas, reservas por aprovação e painéis de empresas, em Next.js oficial com Node.js. Esta versão local é independente da publicação existente no Sites.

Para usar diariamente no Windows, iniciar o servidor, fazer backup ou recuperar o acesso, consulte [Uso local](docs/USO-LOCAL.md). A prioridade atual é a operação local; a publicação na VPS foi adiada pelo proprietário.

## Começar

Requer Node.js da linha 22, versão 22.13.0 ou superior, e npm. A versão verificada nesta revisão é 22.23.2. O arquivo `.nvmrc` seleciona a linha 22 para gerenciadores compatíveis, e o npm recusa versões fora do intervalo definido em `engines`. Use terminal na pasta deste projeto.

```sh
npm ci
npm run setup
npm run db:migrate
npm run admin:create
npm run dev
```

Os comandos `dev`, `build` e `start` verificam a versão do Node e a compatibilidade do módulo SQLite antes de iniciar. Ao voltar de outra linha do Node para a 22, pare o servidor e execute `npm rebuild better-sqlite3` e `npm run check:runtime`. Veja [a solução para erros de versão do Node](docs/USO-LOCAL.md#erro-node_module_version-ou-err_dlopen_failed).

Abra http://127.0.0.1:3005 e `/painel/contato` (`/admin` redireciona para essa página). O comando admin:create solicita a senha duas vezes com asteriscos; use entre 12 e 128 caracteres. Maiúsculas, minúsculas e espaços contam. Backspace apaga o último caractere e Ctrl+U limpa a digitação. Não envie senhas pelo chat nem pela linha de comando. O e-mail autorizado inicialmente é rogerio1kg@gmail.com. O login é próprio desta instalação, independente da senha do ChatGPT. O cadastro público em /cadastro cria apenas contas básicas. Perfis empresariais dependem de autorização do administrador.

A configuração local fica em .env.local, ignorada pelo Git. setup gera um segredo aleatório sem exibi-lo e preserva uma configuração existente. O banco fica em data/hub.sqlite. O primeiro acesso administrativo exige executar admin:create em um terminal interativo.

## Funcionalidades

- Site institucional, privacidade, identidade visual e conteúdo preservados.
- Formulário público com validação Zod, consentimento, honeypot, limite de corpo e envios.
- Idempotência: repetir uma tentativa não duplica a mensagem; reutilizar chave com outro conteúdo retorna conflito.
- Painel paginado com estados de carregamento, vazio, erro e sucesso.
- Login por e-mail/senha, logout, sessão e autorização no servidor.
- Respostas aos contatos continuam manuais, pelo aplicativo de e-mail do operador.
- Catálogos públicos, perfis de guia, cadastro/login e acompanhamento das reservas do turista.
- Módulo público de Navegação: filtros de transporte e destinos, roteiros Maués ↔ Manaus, contatos, tarifas de referência e pacotes com fontes. Consulte [Navegação e pesquisa](docs/NAVEGACAO.md).
- Painéis de hotel (quartos, reservas e estadias locais), operador (experiências, guias, agenda e vagas) e administração (empresas e permissões).
- Aprovação de solicitações com controle transacional de disponibilidade e isolamento por empresa.
- Sem pagamentos, e-mails automáticos ou transmissão oficial de FNRH.

### Navegação pública

O cabeçalho reúne a marca, atalhos para **Hospedagens**, **Passeios**, **Gastronomia**, **Guias** e **Navegação**, além do botão **Acessar minha conta**. O footer funciona como um mapa abrangente do site, com blocos para a marca e contato, **Explore o Amazonas** (incluindo Agências e Serviços turísticos), **Sua conta** e **Informações**. A disposição se adapta a telas menores.

Veja [Módulos e operação](docs/PLATAFORMA.md) para o mapa completo de rotas, regras, permissões e primeiro cadastro de empresas.

Empresas podem ter nome fantasia separado do nome cadastrado, com prioridade nas listagens, painéis e reservas. A importação Cadastur também prioriza a coluna Nome Fantasia, usando o nome alternativo quando necessário. Esta atualização exige backup e `npm run db:migrate` para aplicar a migração 004, que preserva os dados existentes.

## Arquitetura e pastas

Uma aplicação, uma origem HTTP e um banco local ao servidor; frontend e backend permanecem separados em módulos.

```text
app/                  Páginas, metadados e rotas HTTP
components/site/      Cabeçalho, footer institucional, formulário, login e contatos
components/platform/  Catálogos, reservas, seletor de módulos e painéis
components/ui/        Componentes reutilizáveis preservados
lib/                  Validação compartilhada e configuração do site
server/               Contatos, empresas, catálogo, reservas, autenticação e autorização
db/                   Conexão SQLite, migrações e integração de autenticação
scripts/              Setup, migração, contas, senha, backup e restauração
tests/                Testes de serviços e integração HTTP
infra/                Exemplos de Nginx e systemd
docs/                 Plano, API, publicação e verificação
public/               Imagens, ícones e fontes locais
data/                 Banco local (ignorado)
backups/              Backups locais (ignorados)
```

Tecnologias: React 19, Next.js 16, TypeScript, Zod, Better Auth e better-sqlite3. A aplicação não utiliza Workers, D1 ou Drizzle. A conexão ativa é SQLite direto.

## Banco e autenticação

contacts armazena mensagem, identidade do contato, consentimento, versão do aviso e chave de idempotência. rate_limits guarda contadores temporários derivados do IP/e-mail. schema_migrations controla migrações SQL com checksum. As tabelas user, account, session, verification e rateLimit pertencem ao Better Auth. A migração 002 acrescenta companies, company_members, rooms, guides, tours, departures, bookings, stay_records e platform_audit, preservando os dados anteriores.

A migração 007 acrescenta a situação operacional dos quartos. Antes de usar esta versão em um banco existente, faça backup e execute `npm run db:migrate`.

As senhas são processadas pela biblioteca de autenticação; não há senha padrão. Sessões têm validade de oito horas, com renovação durante o uso, são revogadas no logout e não usam cache de autorização no navegador. O servidor verifica ADMIN_EMAILS a cada consulta. Conhecer o e-mail autorizado não concede acesso.

```sh
npm run admin:password
npm run account:password -- EMAIL_DA_CONTA
npm run db:backup
npm run db:restore -- backups/arquivo.sqlite data/restaurado.sqlite
```

A recuperação de senha exige acesso ao terminal do servidor e encerra as sessões anteriores. A restauração exige arquivo de destino inexistente, verifica integridade e não substitui o banco ativo. Consulte docs/DEPLOY.md para troca do banco e agendamento de backups.

### Quando o painel informar e-mail ou senha incorretos

1. Abra `http://127.0.0.1:3005/painel/contato` (ou `/admin`, que redireciona para ela). Confira o e-mail e use “Mostrar senha” para conferir a digitação, se necessário. A tela também informa quando Caps Lock está ativado.
2. Para redefinir, execute `npm run admin:password -- rogerio1kg@gmail.com` em um terminal na pasta deste projeto. Digite a nova senha e repita a confirmação. O comando verifica a senha gravada antes de informar sucesso; senhas acima do limite são rejeitadas, nunca cortadas.
3. Entre com a nova senha. A alteração vale imediatamente para este banco, sem reiniciar o servidor; sessões anteriores são encerradas. Se houver bloqueio por tentativas, aguarde um minuto sem tentar antes de entrar novamente.

Não é possível recuperar a senha anterior a partir do hash. O reset local não altera a conta nem o login do site publicado no Sites.

## APIs

| Método | Caminho                    | Uso                                        |
| ------ | -------------------------- | ------------------------------------------ |
| POST   | /api/contatos              | Envio público com Origin e Idempotency-Key |
| GET    | /api/admin/contatos?page=1 | Consulta autenticada e autorizada          |
| GET    | /api/health                | Saúde do banco                             |
| GET    | /api/openapi               | Contrato OpenAPI                           |
| POST   | /api/auth/sign-in/email    | Login por e-mail/senha                     |
| POST   | /api/auth/sign-out         | Revogar a sessão atual                     |
| GET    | /api/auth/get-session      | Consultar a sessão atual                   |

A plataforma acrescenta GET /api/catalogo/_, POST /api/conta/cadastro e GET/POST /api/plataforma/_. O contrato completo está em /api/openapi e docs/openapi.json. O endpoint genérico de cadastro do provedor e a recuperação automática por e-mail permanecem bloqueados; o cadastro básico usa exclusivamente a rota controlada /api/conta/cadastro. Erros do domínio retornam error.code, message e requestId. Erros do provedor de autenticação seguem seu contrato, descrito no OpenAPI.

## Testes e qualidade

```sh
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
npm run test:integration
```

Integração usa um banco temporário, contas fictícias, senhas aleatórias e servidor isolado na porta 3100; não modifica a produção ou o banco de desenvolvimento. A porta deve estar livre. Não execute duas integrações ao mesmo tempo.

CI definido em .github/workflows/ci.yml: instalação pelo lockfile, configuração temporária, migração, formato, tipos, lint, testes, build e integração. A execução remota depende de um repositório GitHub com Actions habilitado; nenhum repositório foi publicado automaticamente.

## Segurança, desempenho e publicação

SQL parametrizado, transação atômica para contatos, índice de idempotência e ordenação, paginação de 20 itens, página institucional pré-renderizada, catálogos dinâmicos, assets locais e cache privado/no-store na administração. Há validação de origem, cookies HttpOnly/SameSite e cookies Secure em HTTPS. Nenhum segredo deve ir para Git, public ou logs.

As novas listas de reservas e inventário ainda não possuem paginação; o dimensionamento deve ser revisto com o aumento do volume. Contas básicas ainda não verificam o e-mail por mensagem: confirme a identidade diretamente antes de conceder acesso empresarial.

O CSP atual permite scripts inline necessários ao build; não é uma política de nonce estrita. Ao aumentar o uso de conteúdo dinâmico, reavaliar essa decisão. O proxy deve sobrescrever x-real-ip e o Node aceitar conexões somente do proxy para o rate limit por IP ser confiável.

A aplicação precisa de disco persistente, HTTPS e backup fora da máquina. Consulte docs/DEPLOY.md. A versão publicada no Sites permanece separada. Os documentos anteriores em docs/ANALISE-E-ARQUITETURA.md e docs/VERIFICACAO-SITES.md descrevem a implementação antiga, não esta arquitetura.

## Cadastur — v0.4.0

O administrador encontra o importador em `/painel/plataforma/cadastur`: fontes oficiais do MTur, CSV/XLSX, prévia, filtros, contatos comerciais e revisão com publicação explícita e vínculos opcionais. A migração 005 preserva registros existentes e amplia as categorias. Veja [diretório público e importação](docs/DIRETORIO-PUBLICO.md) e [histórico da integração Cadastur](docs/INTEGRACAO-CADASTUR.md). O worker em `server/cadastur/file-worker.mjs` deve acompanhar o projeto na execução local; não copie somente a pasta `.next`.

## Conteúdo editorial dos catálogos

Em `/painel/plataforma/conteudos`, o administrador mantém apresentações e imagens dos sete módulos. Itens podem ficar como rascunho ou ser publicados. Registros do Cadastur recebem um complemento editorial ligado à fonte oficial, preservando a separação entre informações oficiais e conteúdo da Hub. A migração 008 cria a tabela dos conteúdos; faça backup antes de `npm run db:migrate`.

Para atualizar os cinco conjuntos do Amazonas: `npm run cadastur:sync -- --apply --publish`. O comando cria e verifica um backup antes de migrar/importar e registra as contagens de cada aba. Omita `--publish` para manter as inclusões/alterações em revisão interna. A execução exige um administrador existente em `ADMIN_EMAILS`; não cria contas.
