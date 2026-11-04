# Arquitetura evolutiva do Hub

## Objetivo

Evoluir o Hub por módulos e versões pequenas, mantendo uma aplicação implantável em VPS, preservando os dados e evitando uma reescrita ampla a cada nova necessidade.

## Direção técnica

- **Monólito modular**: uma aplicação Next.js/Node e um banco PostgreSQL. Não dividir em microserviços enquanto a operação não exigir isso.
- **PostgreSQL como banco de produção**: hospedado no mesmo servidor inicialmente, em volume persistente e sem porta pública. O processo web conecta com uma conta sem privilégios de superusuário; a conta administrativa fica reservada ao bootstrap e aos scripts de backup/restauração. SQLite continua disponível para desenvolvimento local até que os caminhos de banco e os fluxos estejam validados em PostgreSQL.
- **Acesso ao banco por adaptadores**: conexões, transações e locks ficam em `db/index.ts`; a conversão dos placeholders portáveis `?` para PostgreSQL fica isolada em `db/postgres-sql.ts`. Novos dialetos não devem ser introduzidos nos serviços de domínio.
- **Erros compartilhados sem dependência invertida**: `HttpError` vive em `lib/http-error.ts`. `server/http.ts` o reexporta para preservar os imports existentes, enquanto `db/` não depende do adaptador de resposta HTTP para mapear violações de unicidade.
- **Limites por domínio**: identidade e permissões; Cadastur e diretório; catálogo editorial; empresas; reservas e operação; navegação; contatos; infraestrutura compartilhada.
- **Adaptadores HTTP finos**: páginas e rotas traduzem requisições, enquanto regras de negócio continuam nos serviços de domínio. Alterações em um módulo não devem reimplementar autorização ou SQL em componentes de interface.
- **Arquivos de catálogo**: gravação, leitura e remoção passam pelo adaptador `server/media-storage.ts`; a primeira instalação PostgreSQL usa a tabela `catalog_media` já prevista no projeto. Se o volume de imagens crescer, esse adaptador poderá receber um provedor de objeto compatível com S3 sem alterar as rotas de mídia.
- **Uma instância web**: manter uma instância Next.js na primeira VPS. A configuração de cache local do Next.js não é compartilhada entre várias instâncias.

## Evolução sem reescrita

Os módulos atuais estão distribuídos entre `app/`, `components/`, `server/`, `lib/` e `db/`. A organização por domínio deve acontecer conforme cada área receber mudanças: mover primeiro uma funcionalidade, manter a rota pública existente como adaptador e preservar os contratos API que já têm consumidores. Evitar uma mudança de pastas em massa que não acrescente comportamento.

Cada versão deve declarar:

1. O domínio e o resultado esperado para quem usa o sistema.
2. As regras de negócio e permissões afetadas.
3. Se há mudança de banco, com migração nova e estratégia de retorno.
4. Como a funcionalidade será verificada no CI e no ambiente de homologação.
5. Como publicar a versão e confirmar saúde, login e fluxos daquele domínio.

Migrações SQL aplicadas não devem ser editadas; mudanças de esquema entram em um novo arquivo numerado. Mudanças incompatíveis na API precisam de contrato e plano de transição antes de remover rotas antigas.

Na modularização em andamento, as rotas de painel mantêm autenticação e composição, e as telas são organizadas por domínio. A administração separa cadastro de empresas, vínculos de equipe e métricas gerais; o catálogo separa gestão editorial das consultas públicas e mantém o vínculo Cadastur; o hotel separa gestão de quartos e registro local de estadias; experiências separam gestão de passeios, guias e agenda de saídas; reservas e vagas formam uma visão operacional compartilhada. `components/platform/directory/provider-listing.tsx`, `provider-card.tsx`, `provider-detail.tsx`, `provider-attribution.tsx` e `config.ts` organizam o diretório público por responsabilidade; catálogo, experiências e navegação importam cartões sem depender da composição da listagem ou do detalhe. `server/account-service.ts` valida e atualiza o perfil da própria conta e atribui o avatar inicial no cadastro. `server/business-panel-read-service.ts` compõe os dados de leitura por área e seção, com contrato nomeado. Os serviços `inventory-read-service.ts` e `inventory-write-service.ts` separam consultas e alterações do inventário; `booking-read-service.ts` e `booking-write-service.ts` separam consultas e operações que alteram reservas; `company-membership-service.ts` isola vínculos e permissões; `cadastur/import-service.ts` prepara e valida prévias; `cadastur/import-commit-service.ts` confirma alterações em transação, e `cadastur/directory-service.ts` trata revisão/publicação. `server/nearby-recommendations.ts` coordena cache e apresentação, enquanto `server/nearby/openstreetmap.ts` encapsula geocodificação, consulta Overpass e controle de chamadas. Verificações de acesso e regras transacionais permanecem no servidor. `company-service.ts`, `booking-service.ts` e `cadastur/service.ts` continuam exportando os nomes antigos para preservar integrações internas durante a transição.

No envio de e-mail, `server/email-transport.ts` reúne configuração SMTP e envio transacional genérico; `server/account-email.ts` reúne confirmação, recuperação e aviso de troca de senha. `server/email.ts` permanece como fachada compatível para as páginas e a autenticação existentes, enquanto `server/booking-email.ts` usa diretamente o transporte genérico. Nenhuma credencial ou conteúdo de e-mail é passado aos componentes interativos.

No módulo de acessos de empresas, `company-membership-read-service.ts` reúne listagem, paginação e contagem; `company-membership-write-service.ts` mantém concessão/revogação, validação de perfil, escopo da empresa e auditoria transacional. `company-membership-service.ts` preserva os exports importados por APIs e painéis.

No painel Cadastur, `components/platform/cadastur/directory-management.tsx` separa busca, revisão e vínculo dos registros da etapa de importação. `source-step.tsx`, `mapping-step.tsx` e `preview-step.tsx` isolam cada etapa de entrada de dados, enquanto `cadastur/api.ts` centraliza o contrato HTTP e o painel principal coordena estado, validação e chamadas do fluxo.

Na importação Cadastur, `server/cadastur/import-service.ts` valida o mapeamento, compara os candidatos com o banco e persiste a prévia; `import-normalization.ts` transforma linhas, filtra dados pessoais, identifica duplicidades e compõe avisos. `import-commit-service.ts` continua responsável pela confirmação transacional, e `service.ts` preserva os nomes usados pelos consumidores internos.

Nas reservas, `booking-write-service.ts` mantém a fachada já importada pelas rotas; `booking-request-service.ts` cuida da criação idempotente, `booking-lifecycle-service.ts` trata aprovação e cancelamento, `booking-stay-service.ts` mantém check-in e check-out hoteleiros, e `booking-availability.ts` concentra as verificações compartilhadas de quarto e saída. As gravações e bloqueios continuam dentro das mesmas transações. `booking-customer-read-service.ts` reúne consultas e resumos do turista; `booking-business-read-service.ts` reúne listas, resumos, estadias e pendências operacionais; `booking-read-model.ts` mantém a paginação e a consulta em lote do histórico de auditoria; `booking-read-service.ts` preserva a fachada para os consumidores atuais. As listas paginadas montam uma linha do tempo com os eventos de auditoria já existentes, limitada às reservas do titular ou da empresa autorizada; não há nova tabela nem alteração de estado. A caixa de avisos da interface pagina 20 itens e permite chegar ao histórico completo. Na API, `server/platform-bookings-api.ts` concentra os adaptadores de leitura e gravação de reservas, `server/platform-notifications-api.ts` concentra os de leitura e marcação de avisos, `server/platform-companies-api.ts` concentra listagens e alterações de empresas e vínculos, `server/platform-catalog-api.ts` concentra consulta e edição de conteúdo e `server/platform-inventory-api.ts` concentra as rotas de consulta e gravação do inventário; a rota catch-all mantém autenticação e despacho. `GET /notificacoes?page=N` oferece paginação aditiva e, sem `page`, preserva a resposta de até 100 registros.

Na caixa de notificações, `notification-read-service.ts` concentra consultas e contagem de não lidas, `notification-write-service.ts` concentra criação, marcação e geração de mensagens na outbox dentro da transação existente, `notification-model.ts` define os eventos e o formato, e `notification-service.ts` mantém a fachada importada por rotas, páginas e serviços de reservas.

Nas leituras de inventário, `inventory-read-model.ts` centraliza a paginação de 20 itens; `inventory-room-read-service.ts` reúne a listagem e o resumo operacional de quartos; `inventory-experience-read-service.ts` contém as consultas paginadas e opções de guias, passeios e saídas; `inventory-legacy-read-service.ts` preserva a resposta completa sem paginação, inclusive as permissões específicas de guia; `inventory-read-service.ts` mantém a fachada usada pelos painéis e pela API e compõe as respostas paginadas. Nas gravações, `inventory-room-write-service.ts` cuida de quartos e situação operacional; `inventory-experience-write-service.ts` cuida de guias, passeios e saídas; `inventory-write-service.ts` conserva a fachada consumida por rotas, serviços e integrações internas. As regras de capacidade, auditoria, escopo da empresa e transações permanecem nos mesmos fluxos.

Na administração de empresas, `company-write-service.ts` mantém o cadastro e atualização das empresas; `company-admin-read-service.ts` concentra contagens e seletores administrativos de guias; `company-service.ts` preserva a fachada consumida pelas rotas, painéis e integrações existentes.

Na autorização, `platform-authorization.ts` concentra o allowlist de administradores e a verificação de vínculo/estado da empresa; `platform-company-read-service.ts` mantém as consultas paginadas e os seletores já limitados ao escopo do usuário. `platform-access.ts` preserva a fachada importada pelas rotas e serviços.

No explorador de navegação, `components/platform/navigation/search-form.tsx` apresenta os filtros controlados pelo componente principal; `route-results.tsx` organiza os trechos filtrados; `vessel-schedule.tsx` isola horários e contatos das embarcações; `packages.tsx` apresenta as experiências; e `practical-guidance.tsx` concentra as orientações ao viajante. `navigation/attribution.tsx` concentra fontes e preços compartilhados pelas seções públicas.

No diretório público, provider-listing.tsx coordena a página; provider-search-area.tsx contém formulários e filtros, lodging-highlights.tsx apresenta referências de hospedagem, bookable-hotels.tsx cuida das opções reserváveis e provider-results.tsx compõe resultados, paginação e atribuição de fontes. No servidor, `cadastur/public-directory.ts` compõe as consultas e mantém as exportações usadas pelas páginas e rotas; `public-directory-model.ts` converte registros Cadastur, conteúdo Hub e edições; `public-directory-search.ts` concentra a CTE, facetas e paginação. Filtros, ordenação, parâmetros de URL e contratos atuais permanecem iguais.

No diretório de experiências, `experience-directory-service.ts` conserva a consulta unificada e a coordenação de filtros/paginação; `experience-directory-model.ts` define o contrato das quatro categorias de resultado e converte linhas SQL nos cartões públicos. Essa divisão deixa a SQL pronta para futura análise de planos PostgreSQL sem misturar otimização de consulta com o formato consumido pela interface.

No módulo de proximidades, `server/nearby-recommendations.ts` coordena a atualização da localização e dos resultados; `nearby/cache.ts` persiste e valida o cache; `nearby/recommendation-builder.ts` calcula distâncias, associa restaurantes cadastrados e ordena sugestões; `nearby/openstreetmap-request-limits.ts` serializa o espaçamento entre consultas e o limite diário do Overpass na tabela existente; `nearby/openstreetmap.ts` mantém a integração externa. A rota pública preserva o contrato atual.

No catálogo público, os módulos public-directory.tsx, hotel-detail.tsx, tour-detail.tsx e guide-detail.tsx separam listagem e detalhes por domínio; catalog-pages.tsx mantém as exportações usadas pelas rotas. No servidor, `catalog-hotel-read-service.ts` concentra busca e detalhe de hospedagens; `catalog-experience-read-service.ts` concentra busca e detalhe de passeios e guias; `catalog-read-model.ts` compartilha paginação e leitura dos filtros; `catalog-service.ts` preserva os exports usados por API, páginas e sitemap. No editor editorial, catalog-content-form.tsx coordena validação, gravação e exclusão; content-fields.tsx organiza os campos e media-editor.tsx concentra upload, links e prévias. `catalog-content-read-service.ts` reúne as leituras paginadas e a composição da página de gestão, `catalog-content-write-service.ts` reúne criação, atualização, exclusão e limpeza de imagens, enquanto `catalog-content-service.ts` mantém as exportações administrativas e públicas existentes. Os contratos HTTP existentes continuam nos mesmos endpoints.

## Sequência proposta

### Versão 0.5 — Base operacional PostgreSQL e VPS

- **Estado:** publicada como versão 0.12.0 na VPS. A origem SQLite oficial foi transferida após prévia e comparação; o endpoint público confirmou aplicação e PostgreSQL em 15/10/2026. O backup PostgreSQL local passou por ensaio de restauração em banco separado; a cópia externa foi adiada e ainda precisa ser configurada, recebida e restaurada. A validação operacional do worker e do SMTP também continua pendente.
- Executar aplicação e PostgreSQL em Docker Compose, com banco persistente não exposto à internet.
- Migrar dados do SQLite local em um processo separado, comparando contagens e incluindo imagens locais referenciadas.
- Configurar Nginx/HTTPS, limites de upload, saúde do serviço e backup PostgreSQL diário com retenção, ensaio de restauração em banco separado e cópia externa.
- Manter a publicação atual até a homologação e a troca de domínio.

### Versão 0.6 — Contas e operação confiáveis

- **Primeira entrega:** confirmação e recuperação de contas por e-mail via SMTP opcional; o requisito de confirmação permanece desligado para preservar o login das contas já migradas.
- **Pendente:** configurar credenciais SMTP na instalação e homologar cadastro, confirmação, recuperação e aviso de troca de senha.
- **Concorrência PostgreSQL:** decisões de reservas e alterações de capacidade/situação de quarto ou saída bloqueiam o mesmo recurso; um teste dedicado valida interleavings concorrentes no PostgreSQL.
- **Listas de operação:** reservas de turistas, reservas empresariais, estadias FNRH, quartos, passeios, guias e saídas consultam 20 registros por página no banco. Os painéis usam agregações para os resumos; parâmetros opcionais de página nas APIs preservam as respostas completas dos clientes antigos que não os enviam.
- **Acessos administrativos:** vínculos de usuários com empresas são paginados em blocos de 20; `GET /api/plataforma/acessos?page=1` inclui metadados e a resposta anterior continua disponível sem o parâmetro.
- **Fronteira entre navegador e servidor:** a CI percorre os imports executáveis de todos os pontos de entrada `use client` e impede que código de `server/` ou `db/` entre no grafo enviado ao navegador; imports somente de tipos continuam permitidos.
- **Listas de gestão:** empresas, diretório Cadastur e conteúdo editorial consultam 20 registros por página. Resumos usam contagens agregadas; a API de empresas mantém a lista completa quando `page` não é informado, e `GET /api/plataforma/conteudos` consulta por categoria e página.
- **Opções administrativas e operacionais:** os filtros de empresa em Acessos e Auditoria pesquisam por nome ou município no servidor, em blocos de 20, e só retornam empresas acessíveis à conta autenticada. O seletor dos painéis operacionais usa a mesma busca, filtrada por tipo. Cadastur pesquisa hotéis e guias em blocos de 20; os nomes já vinculados chegam com cada página do diretório, sem carregar listas inteiras.
- **Auditoria administrativa:** consulta somente leitura, com filtro por empresa e paginação, disponível em `/painel/plataforma/auditoria`; a migração `011_platform_audit_indexes.sql` adiciona índices sem alterar registros existentes.
- **Relatório administrativo inicial:** o painel exclusivo da administração mostra totais acumulados de reservas por tipo e situação, sem expor dados pessoais.
- **Diretórios públicos:** prestadores e experiências consultam filtro, contagem e página diretamente no banco, com limite de 24 resultados; a seção de hotéis reserváveis tem páginas independentes de 6 itens. As listagens públicas da API de hospedagens e passeios aceitam `?page=` para buscar 24 registros por vez, mantendo o formato completo antigo quando o parâmetro não é enviado. Facetas são cacheadas no processo e invalidadas pelas gravações da aplicação. As migrações `013`–`016` adicionam índices parciais; a migração PostgreSQL `001_public_text_trigram_indexes.sql` versiona o normalizador, instala `pg_trgm` e acrescenta índices trigram para hospedagens, passeios e conteúdo Hub sem vínculo Cadastur. A linha de base em PostgreSQL 18.6 descartável usou 20 mil linhas sintéticas por grupo Cadastur, guias, tours e conteúdo Hub; as consultas de contagem/página levaram cerca de 203 ms cada no diretório e 1,08–1,12 s cada em experiências, com varreduras sequenciais em Cadastur, guias e tours. Um segundo ensaio adicionou índices trigram para essas fontes e fez buscas multi-termo sobre 20 mil linhas por fonte. O plano continuou usando varreduras sequenciais em Cadastur, guias, tours e empresas, e o tempo das experiências ficou em torno de 1,0 s; só o índice existente de conteúdo Hub foi usado. A migração tentativa foi removida, sem adicionar custo de escrita e armazenamento sem benefício. A busca atual exige que cada termo apareça no texto público concatenado do mesmo resultado, em qualquer ordem, preservando buscas como guia + cidade. Essas medições sintéticas não são teste de carga nem previsão de capacidade VPS. A próxima otimização precisa usar uma estrutura indexável que o planejador realmente escolha e ser medida com dados representativos; o conteúdo oficial atual tem 2.721 entradas Cadastur e não contém tours, guias ou catálogo editorial.
- **Permissões por perfil:** `platform-authorization.ts` mantém a matriz e aplica as regras nas leituras e gravações dos serviços. Gestores hoteleiros mantêm o cadastro operacional dos quartos; a equipe opera quartos, reservas e estadias; operadores administram catálogo, agenda e reservas; guias consultam somente as próprias saídas vinculadas por `company_members.guide_id`. A migração aditiva `018_guide_member_assignment.sql` não associa contas existentes automaticamente. Contas antigas de guia precisam de vínculo explícito pela administração, e ficam sem acesso à agenda até a configuração. A matriz atual e seus limites estão descritos em `docs/PLATAFORMA.md`.
- **Isolamento entre empresas:** a integração HTTP usa empresas e perfis fictícios para confirmar que uma conta não consulta nem altera reservas/inventário fora dos próprios vínculos. A validação operacional com as empresas reais continua pendente.
- **Estados, notificações e auditoria de reservas (0.6.2):** pedidos e decisões geram avisos no sistema; turista e equipe abrem o cartão autorizado da reserva e veem os eventos auditados disponíveis. A aceitação dos textos e do fluxo de trabalho com hotéis e operadores continua pendente.
- **Lembretes internos de reservas (0.12):** a migration aditiva `022_booking_reminders.sql` registra lembretes únicos na caixa do turista para reservas confirmadas na janela de 24 horas. Hotéis usam 09:00 de Manaus no dia de check-in como referência; passeios usam a hora da saída. A geração roda junto ao worker existente mesmo com e-mail desativado, sem adicionar chamadas SMTP.

### Versão 0.7 — Entrega opcional de avisos por e-mail

- Estender os eventos atuais de reserva para e-mail por uma fila transacional, sem substituir a caixa interna.
- Manter o canal desligado por padrão; enviar somente com SMTP configurado e um worker separado em Compose.
- Repetir falhas com espera progressiva, guardar estado operacional fora do fluxo HTTP e evitar replay da fila em migrações de dados.
- Pagamentos, cancelamento/reagendamento e novas integrações continuam separados até que as regras de negócio sejam aprovadas.

### Versão 0.8 — Operação observável de notificações

- **Estado:** implementação e validação local concluídas; publicação e SMTP real continuam pendentes.
- Disponibilizar no painel administrativo a contagem da fila transacional de e-mails e as falhas terminais recentes.
- Limitar a leitura a administradores, agrupar destinatários sem expor e-mails de hóspedes e manter reabertura/reenvio no comando operacional explícito.
- Deixar claro que a fila persistida não atesta a saúde do worker nem do SMTP; acompanhar saúde do processo e integração externa exige telemetria própria.

### Versão 0.9 — Sinal do worker de notificações

- **Estado:** implementação e validação automatizada local concluídas; publicação e SMTP real continuam pendentes.
- Registrar em uma tabela operacional se o worker de e-mail está ativo, desativado ou foi encerrado de forma controlada; considerar o sinal vencido após 45 segundos sem atualização.
- Exibir o último sinal apenas no painel administrativo de notificações. A indicação descreve a atividade reportada pelo processo e não confirma credenciais SMTP, aceitação ou entrega de mensagens.
- Manter esse estado fora da transferência de dados oficiais SQLite→PostgreSQL: a nova instância VPS deve produzir seu próprio sinal.
- A migration `021_booking_email_worker_heartbeat.sql` é aditiva; ao retornar o binário 0.8, manter o schema e preservar o outbox.

### Versão 0.10 — Atualização automática da operação de notificações

- **Estado:** typecheck, lint, testes locais, integração HTTP, build, imagem e Compose local passaram; publicação pendente.
- Atualizar a tela administrativa do worker a cada 15 segundos enquanto estiver visível; atualizar imediatamente quando a aba volta a ficar visível.
- Manter a atualização no navegador somente nessa tela operacional, sem polling de APIs públicas ou de outras páginas.
- Não exige migration nem altera a semântica dos estados, reservas, notificações ou envio de e-mail. O retorno ao binário 0.9 é apenas de código.

### Versão 0.11 — Preflight local da VPS

- **Estado:** preflight, checks de código/documentação, build de imagem e smoke Compose passaram localmente. Publicação continua pendente.
- Expor `scripts/check-vps-env.mjs` como `npm run check:vps-env`, usando `infra/vps.env` e comparando `APP_VERSION` com `package.json`.
- Manter a validação sem exibir valores secretos; cobrir configuração válida, domínio de exemplo e divergência de versão com fixtures temporárias.
- Não alterar schema, credenciais, base oficial ou recursos Docker. A verificação Linux de permissões continua disponível no mesmo validador.
- Imagem `hub-turismo-amazonas:0.11.0` construída; Compose descartável confirmou saúde em PostgreSQL e versão 0.11.0. Os recursos temporários foram removidos.

### Versão 0.12 — Lembretes internos de reservas

- **Estado:** publicada na VPS em 15/10/2026. O endpoint público confirmou a versão 0.12.0 com PostgreSQL; o operador confirmou que o Turnstile voltou a carregar após reconfigurar o ambiente. O worker de lembretes e o SMTP real ainda precisam de validação operacional. O backup local passou por ensaio de restauração; a cópia externa ficou para depois e não foi validada.
- Criar lembretes internos idempotentes para reservas confirmadas na janela de 24 horas; usar 09:00 de Manaus no dia de entrada para hospedagens e o horário da saída para passeios.
- Exibir o lembrete na caixa de notificações do turista, respeitando o estado de leitura individual. Não gerar e-mail nem repetir lembretes após cancelamento.
- Manter schema aditivo e compatível com versões anteriores; transferir o estado existente de lembretes, quando houver, junto aos dados da reserva.
- Worker opera os lembretes com SMTP desativado; configuração do canal de e-mail e outbox não mudam.
- `npm test` em PostgreSQL 18.6 passou com 62 testes, 0 falhas e 1 ignorado por depender de bash POSIX. Typecheck, lint, arquitetura, formatação e checks de versão passaram.
- A origem oficial foi comparada ao backup e aplicada integralmente em PostgreSQL 18.6 descartável com o schema 0.12.0; as contagens foram confirmadas e o destino descartado. A imagem Linux foi construída e o Compose confirmou os três serviços saudáveis, versão 0.12.0 e worker de lembretes ativo com SMTP desativado; rede, containers e volume foram removidos.

### Versão 0.12.1 — Saúde do worker e adaptadores HTTP por domínio

- **Estado:** candidata local; versão, tipos, arquitetura, Compose, lint, formatação e build de produção passaram; os cenários de heartbeat e a publicação ainda estão pendentes.
- O healthcheck do Compose consulta o heartbeat no PostgreSQL e marca o worker como não saudável quando o estado não é `running`, o sinal está vencido ou o banco não responde.
- A fila transacional de e-mails e seu processador são módulos separados: `booking-email-queue-service.ts` mantém enqueue e operações persistidas; `booking-email-delivery-service.ts` controla lease, tentativas e confirmação sem importar SMTP. O worker injeta `sendBookingEmail`; `booking-email-outbox.ts` preserva a fachada de compatibilidade.
- A transferência SQLite→PostgreSQL mantém a orquestração no CLI e isola leitura, verificação do manifesto, validação e transformação de mídias de catálogo em `scripts/sqlite-postgres-transfer-media.ts`.
- Os catálogos de português, inglês e espanhol ficam em módulos próprios de `lib/i18n/`; `messages.ts` mantém a fachada e as funções de tradução para preservar os imports existentes.
- Os esquemas compartilhados de empresas, inventário, catálogo, reservas e contas ficam em `lib/platform-schema/`; `lib/platform-schema.ts` preserva a fachada pública. O TypeScript ignora `tmp/`, que contém snapshots e pacotes, para compilar apenas as fontes do checkout.
- Serviços e componentes importam schemas dos módulos de domínio diretamente; a fachada agregadora continua disponível para compatibilidade com consumidores legados.
- Não altera tabelas, reservas, lembretes, SMTP ou os dados existentes. Para rollback, voltar a imagem e retirar o healthcheck que chama o script novo.

### Versão 0.12.2 — composição dos formulários do painel

O componente público `ActionForm` coordena estado, envio HTTP, feedback e atualização da rota. A renderização de controles fica em `components/platform/action-form/fields.tsx`; a conversão de `FormData` e validação dos payloads fica em `submission.ts`, com os tipos isolados em `types.ts`. Os consumidores preservam o mesmo import e os caminhos HTTP continuam inalterados.

### Versão 0.12.3 — consulta de proximidades no cliente

O hook `components/platform/nearby/use-nearby-recommendations.ts` controla a requisição à API de proximidades, timeout, cancelamento e repetição. `NearbyRecommendations` continua responsável pela apresentação dos estados, traduções, resultados e links externos. A URL, os validadores do provedor e o tempo limite permanecem iguais.

### Versão 0.12.4 — poda de dependências do runtime

A compilação Next.js pode incluir dependências de desenvolvimento no diretório standalone. Antes de montar a imagem final, a candidata copia o lockfile exato, remove dependências de desenvolvimento e confere as versões de produção; uma verificação recursiva bloqueia a imagem se encontrar a cadeia vulnerável de lint. Não há mudança funcional nem alteração de schema ou dados. A versão permanece candidata local até a cópia externa do backup PostgreSQL ser recebida e validada por restauração independente.

### Versão 0.12.5 — validação da imagem runtime na CI

Depois de construir a imagem VPS, a CI inspeciona usuário, versão, dependências diretas, metadados de desenvolvimento e a cadeia vulnerável dentro do container. Um teto de 550 MB impede regressões grandes de tamanho; a candidata 0.12.4 ficou em aproximadamente 465 MB. Esta etapa não publica a imagem nem altera o banco.

### Versão 0.12.6 — auditoria reproduzível do pacote VPS

Adiciona um verificador local de integridade do pacote de release. Ele confere os hashes, tamanhos, arquivos esperados, manifesto e conteúdo do ZIP de fontes, identidade da imagem Docker e inspeção restrita do runtime. O resultado também informa se o gate da cópia externa do backup continua pendente; não transfere nem publica arquivos.

### Próxima área — Onboarding e gestão editorial

- A linha de base e as decisões para validação estão em [ONBOARDING-EMPRESAS.md](ONBOARDING-EMPRESAS.md). Nenhum formulário público ou migration de onboarding está aprovado.
- Definir com empresas o fluxo de solicitação, análise, vínculo de contas e publicação antes de abrir um onboarding público.
- Formalizar etapas e responsabilidades de revisão editorial e gestão de conteúdo por domínio.
- Ampliar relatórios administrativos somente após definir indicadores, períodos e regras de acesso explícitas.

### Versões posteriores

Pagamentos, integração oficial de FNRH e serviços externos entram somente depois de requisitos, autorização, responsabilidades e tratamento de falhas estarem definidos. Cada integração deve ser opcional e isolada atrás de um adaptador.

## Regra de entrega contínua

Uma conversa ou versão deve resultar em uma mudança delimitada, revisável e reversível. Cada versão do pacote deve ter um registro em `docs/releases/MAJOR.MINOR.PATCH.md`; `npm run check:version` confere o título do release log junto ao pacote, lockfile e versão documentada da plataforma. O trabalho não deve misturar uma alteração de domínio com reestruturações sem relação. Registrar decisões importantes neste documento ou em um ADR curto, atualizar o contrato quando a API mudar e preservar uma forma de voltar para a versão anterior sem perder o banco.
