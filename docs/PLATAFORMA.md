# Plataforma local — módulos e operação

Versão 0.12.19 publicada e verificada na VPS em 06/11/2026. Consulte o [registro da release](releases/0.12.19.md). A plataforma evolui como monólito Node.js/Next.js: SQLite no desenvolvimento e PostgreSQL na VPS. As reservas são **solicitações sujeitas à aprovação do hotel ou operador**, sem cobrança online. O site institucional e a caixa de contatos permanecem disponíveis. A publicação anterior no Sites é independente.

## Rotas e permissões

| Área                  | Rotas                                                                                                                                                                                                                     | Quem acessa                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Institucional         | `/`, `/sobre`, `/contato`, `/privacidade`                                                                                                                                                                                 | Público                                              |
| Entrada da plataforma | `/plataforma` — acesso a hospedagens, navegação, gastronomia, experiências, agências e serviços                                                                                                                           | Público; solicitar reserva exige login               |
| Hospedagens           | `/hospedagens`, `/hospedagens/[slug]`                                                                                                                                                                                     | Público; solicitar exige login                       |
| Experiências          | `/experiencias`, `/passeios/[slug]`, `/guias/[slug]`                                                                                                                                                                      | Público; solicitar passeio exige login               |
| Acesso                | `/entrar`, `/cadastro`, `/recuperar-senha`, `/confirmar-email`, `/redefinir-senha`                                                                                                                                        | Visitantes; contas autenticadas seguem para sua área |
| Turista               | `/minha-conta`, `/minha-conta/reservas`, `/minha-conta/notificacoes`                                                                                                                                                      | Conta autenticada; somente seus dados e avisos       |
| Hotel                 | `/painel/hotel`, `/painel/hotel/quartos`, `/painel/hotel/reservas`, `/painel/hotel/fnrh`                                                                                                                                  | Gestor/equipe vinculados ao hotel ou administrador   |
| Operador              | `/painel/passeios`, `/painel/passeios/experiencias`, `/painel/passeios/agenda`, `/painel/passeios/vagas`                                                                                                                  | Guia/operador vinculados à empresa ou administrador  |
| Administração         | `/painel/plataforma`, `/painel/plataforma/empresas`, `/painel/plataforma/acessos`, `/painel/plataforma/cadastur`, `/painel/plataforma/conteudos`, `/painel/plataforma/auditoria`, `/painel/plataforma/notificacoes-email` | Administrador definido em `ADMIN_EMAILS`             |
| Contatos              | `/painel/contato` (`/admin` redireciona para esta rota)                                                                                                                                                                   | Administrador definido em `ADMIN_EMAILS`             |

O catálogo **Experiências** reúne passeios/roteiros, profissionais da Hub e perfis públicos do Cadastur. Use o filtro para consultar atividades ou guias. `/passeios` e `/guias` continuam redirecionando para o catálogo unificado. No painel, o menu **Experiências** reúne o cadastro de atividades e guias; os endereços antigos `/painel/passeios/passeios` e `/painel/passeios/guias` redirecionam para essa tela. `/painel/passeios/reservas` também abre a lista de solicitações. A empresa em atendimento é selecionada pelo campo do painel; o parâmetro `?empresa=UUID` nunca concede autorização por si só. Endereços não previstos exibem a página de recurso não encontrado.

O cabeçalho institucional mantém **Sobre a Hub** e **Contato**. O botão **Acessar a plataforma** abre `/plataforma`, que reúne os catálogos públicos de hospedagem, navegação, gastronomia, experiências, agências e serviços, além do acesso à conta. Nas páginas da plataforma, o cabeçalho apresenta esses seis módulos como links diretos e oculta os links institucionais; o logotipo retorna à entrada `/plataforma`. O botão contextual oferece **Entrar** ou **Minha conta**. O rodapé da plataforma mantém acesso à entrada, à administração e à privacidade, sem Sobre ou Contato. No site institucional, Sobre e Contato continuam no cabeçalho/rodapé. Após o login, o seletor **Alternar módulo** reúne a conta e os painéis autorizados. A administração pública dos conteúdos dos catálogos fica em **Conteúdos dos catálogos**.

## Primeiro uso pelo administrador

1. Entre em `http://127.0.0.1:3005/entrar` com a conta administrativa existente. A senha permanece a definida localmente.
2. Abra **Minha conta → Administração geral → Empresas**. Cadastre um hotel/pousada ou operador como rascunho. O endereço curto usa letras minúsculas, números e hífens; o tipo da empresa não pode ser trocado depois.
3. Para delegar a operação, peça à pessoa que crie sua conta em `/cadastro`. Com SMTP configurado, o cadastro envia uma confirmação de e-mail; sem SMTP, confirme diretamente que ela controla a conta. Em **Contas e permissões**, vincule o e-mail à empresa e ao perfil correto. Mantenha `REQUIRE_EMAIL_VERIFICATION=false` até confirmar as contas já migradas.
4. No painel hoteleiro, cadastre cada quarto físico com código, nome, capacidade e diária. No painel de experiências, cadastre os passeios e roteiros, os guias e as saídas com data, horário de Manaus e capacidade.
5. Volte a **Empresas** e altere a situação para **Publicado**. Passeios e perfis de guia também têm seu próprio controle de publicação. Quartos e saídas precisam estar ativos para novas solicitações.
6. Um turista entra no catálogo, solicita e acompanha a resposta em **Minhas reservas**. A empresa aprova ou recusa no seu painel.

O diretório público contém referências do Cadastur e conteúdos revisados pela Hub. Na administração, **Conteúdos dos catálogos** permite cadastrar, editar, ilustrar, publicar, deixar como rascunho e remover itens de hospedagens, gastronomia, experiências, agências, serviços turísticos e navegação. Atividades e profissionais continuam classificados internamente para manter seus formulários e fontes corretos. Na revisão do Cadastur, **Completar perfil com informações e imagens** cria um complemento editorial ligado ao registro oficial. Remover esse complemento preserva o registro oficial; sua publicação é controlada pela revisão do Cadastur. A exportação de dados do Cadastur continua usando os campos da fonte oficial. Veja [diretório público](DIRETORIO-PUBLICO.md) para as categorias e atribuição de fonte.

### Nome fantasia nas listagens

Em **Empresas**, mantenha a razão social ou nome cadastrado e preencha **Nome fantasia** com o nome pelo qual o estabelecimento é conhecido. O nome fantasia tem prioridade nos catálogos, painéis, seletores de empresa, permissões e reservas. Se ficar vazio, o nome cadastrado continua sendo exibido. A busca de hospedagens aceita os dois nomes, e a ordenação usa o nome exibido. Nomes de hóspedes, guias, quartos e passeios mantêm seus próprios campos.

A migração `004_company_trade_name.sql` acrescenta o campo sem alterar nomes ou registros existentes. Antes de usar esta atualização, faça backup e execute `npm run db:migrate`. Na API de empresas, `name` mantém o nome cadastrado e `trade_name` é opcional: omitir o campo numa atualização preserva seu valor; enviar texto vazio remove o nome fantasia.

## Modelo de autorização

- Todo cadastro público cria somente uma conta básica. Campos extras, como `role`, são recusados. E-mails reservados à administração não podem ser cadastrados pela rota pública.
- O administrador cria empresas, publica/suspende, concede/revoga vínculos e pode operar todos os módulos. Saber seu e-mail não concede acesso: é necessária uma sessão autenticada.
- `hotel_manager` pode cadastrar/editar quartos, consultar reservas, aprová-las ou recusá-las, atualizar a situação operacional e registrar check-in/check-out. `hotel_staff` pode operar reservas, situações dos quartos e estadias; não pode alterar o cadastro e a capacidade dos quartos.
- `operator` administra guias, passeios, saídas e reservas da operadora. `guide` tem somente leitura da agenda de saídas dos passeios atribuídos ao perfil de guia vinculado à sua conta; vê o total de vagas confirmadas, sem nomes, e-mails ou observações de hóspedes. Guias não alteram o catálogo, a agenda nem reservas.
- A associação entre a conta de guia e o perfil público é escolhida explicitamente no painel de Acessos; não é inferida por nome ou e-mail. A migração `018_guide_member_assignment.sql` acrescenta esse vínculo. Contas de guia que já existiam ficam sem associação até que a administração selecione o perfil correspondente; enquanto isso, o acesso à agenda é bloqueado.
- A mesma conta pode integrar mais de uma empresa. Papel e permissão são verificados no servidor em cada leitura e gravação, inclusive nas APIs. Revogação e suspensão retiram imediatamente o acesso empresarial nas próximas requisições; reservas pessoais continuam acessíveis. Nenhum perfil empresarial concede acesso a contatos gerais.
- Não há atribuição de administrador pela interface. Esse perfil depende da configuração local protegida.

## Reservas e disponibilidade

Estados: `pending` (aguardando aprovação), `confirmed`, `declined` e `cancelled`. A pendência não bloqueia quarto nem retém vagas. A confirmação revalida a disponibilidade em uma transação: SQLite usa `BEGIN IMMEDIATE`; PostgreSQL bloqueia a linha do quarto ou da saída. Edições de capacidade e situação operacional usam o mesmo bloqueio antes de conferir reservas/estadias, serializando alterações concorrentes.

Hospedagens aceitam períodos de 1 a 30 noites, a partir da data atual em Manaus, respeitando a capacidade do quarto. A saída de uma reserva pode coincidir com a entrada de outra. Cada registro de quarto representa uma unidade física, não um estoque de uma categoria.

Cada quarto também possui uma situação operacional: `ready` (pronto), `cleaning` (em limpeza) ou `maintenance` (em manutenção). A ocupação é derivada de uma reserva confirmada com check-in registrado e sem check-out; não pode ser marcada manualmente. O check-out muda o quarto automaticamente para limpeza. A equipe o libera para novas solicitações ao marcá-lo como pronto. Quartos em limpeza ou manutenção não aparecem como disponíveis no catálogo e não aceitam novos pedidos nem check-in até voltarem ao estado pronto.

Passeios têm uma saída futura, capacidade e preço por pessoa. A soma das pessoas em reservas confirmadas não pode exceder a capacidade. Uma saída com solicitações pendentes/confirmadas não pode mudar de passeio ou horário; crie outra saída. Não é permitido reduzir a capacidade abaixo das confirmações existentes.

Valores são calculados no servidor, em centavos, e registrados na solicitação: diária × noites ou valor por pessoa × participantes. Alterar o preço do catálogo não muda os pedidos existentes. O valor é uma referência da solicitação; esta versão não recebe pagamentos.

O turista pode cancelar sua própria solicitação pendente/confirmada antes do início da atividade ou de um check-in registrado. Isso libera capacidade confirmada. Uma solicitação já analisada não aceita uma segunda decisão. Há limite de 20 novas solicitações por conta a cada 24 horas e idempotência por conta/chave UUID.

As notificações internas são persistidas na mesma transação das reservas: a equipe responsável recebe aviso de novo pedido e cancelamento; o turista recebe a decisão da empresa. Cada aviso é individual, deduplicado por evento, reserva e destinatário, possui estado de leitura e só pode ser consultado/alterado por sua conta. Gestores e equipe hoteleira recebem os avisos de hotéis; operadores recebem os de passeios; guias não recebem dados de reserva. A caixa está em **Minha conta → Notificações**, com acesso também pelo menu lateral dos painéis e exibe 20 avisos por página, sem limite de páginas. Cada link de aviso abre a reserva correspondente, sempre validada pelo escopo da conta ou empresa autenticada. A API `/api/plataforma/notificacoes` mantém a resposta existente com até 100 itens e a contagem não lida quando não recebe `page`; com `?page=1`, retorna 20 itens e metadados de paginação. `/notificacoes/lida` e `/notificacoes/ler-todas` atualizam somente avisos da própria conta. Desde a versão 0.7.0, o envio por e-mail é opcional e limitado a pedidos, decisões e cancelamentos. Desde 0.12.0, lembretes de reservas confirmadas são exclusivamente internos e separados da fila SMTP. SMS e push continuam fora do escopo. Nas listas paginadas de reservas, cliente e empresa também veem a linha do tempo dos eventos que a auditoria já registrou, dentro do escopo da própria conta ou empresa.

### Lembretes internos de reservas

A migration aditiva `022_booking_reminders.sql` cria um registro único por reserva confirmada e o inclui na caixa individual de notificações. O worker consulta reservas confirmadas continuamente e grava um lembrete ao entrar na janela de 24 horas: para hotéis, usa 09:00 do dia de check-in no horário de Manaus como referência; para passeios, usa a data e hora da saída. Canceladas e pendentes não geram lembrete. A chave única por reserva e a revalidação do estado evitam duplicação e lembretes de reservas que deixaram de estar confirmadas. O lembrete não dispara e-mail e funciona com SMTP desligado; avisos transacionais e configuração de SMTP existentes permanecem independentes.

## Envio opcional de avisos de reserva

O e-mail é desativado por padrão e não substitui a caixa interna. Para ativá-lo na VPS, configure o SMTP e `BOOKING_EMAIL_NOTIFICATIONS=true` em `infra/vps.env`, valide com `npm run check:vps-env` e recrie os serviços Compose, incluindo `booking-email-worker`. A migration `020_booking_email_outbox.sql` registra cada entrega na mesma transação da reserva; o worker envia pedidos/cancelamentos à equipe e decisões ao turista, com espera progressiva e até oito tentativas. O conteúdo leva somente o nome da empresa, o identificador curto e um link autenticado, sem notas ou dados pessoais do hóspede. Uma falha terminal fica registrada na fila e nos logs do worker. A fila de e-mail é estado de entrega e não é copiada durante a transferência SQLite→PostgreSQL; os avisos internos continuam preservados. O SMTP usa entrega ao menos uma vez: uma interrupção após o provedor aceitar a mensagem pode levar a uma repetição.

Desde a versão 0.8.0, a administração pode consultar `/painel/plataforma/notificacoes-email`: totais por estado e até 20 grupos de falhas terminais, com referência curta da reserva, evento, tentativas, destinatários afetados, código de erro e horário. A consulta é somente leitura, administrativa e não retorna nomes ou endereços dos hóspedes. A versão 0.9.0 também mostra o estado do heartbeat do processo (`ativo`, `desativado`, `encerrado`, `sem sinal recente` ou `desconhecido`) e o horário do último sinal. O processo atualiza o registro a cada 15 segundos; após 45 segundos sem atualização, um worker ativo passa a aparecer como sem sinal recente. Esse heartbeat demonstra apenas que o processo conseguiu gravar no banco; não valida credenciais SMTP, conexão, aceitação ou entrega de mensagens. Consulte os logs de `booking-email-worker` para investigar falhas. A reabertura das falhas continua exigindo o comando operacional com `--confirm`.

A migration aditiva `021_booking_email_worker_heartbeat.sql` cria o registro operacional sem tocar em reservas ou usuários. Como ele descreve a instância antiga, não é transferido do SQLite para o PostgreSQL. O worker novo grava seu próprio sinal quando iniciar; em um rollback para a 0.8.0, mantenha a tabela e os demais dados do schema. Desde a versão 0.10.0, esta tela operacional atualiza os dados a cada 15 segundos enquanto a aba está visível e solicita atualização ao voltar para ela. Desde a 0.12.0, o mesmo worker também gera lembretes internos mesmo quando o e-mail está desativado.

## Estadias e FNRH

A rota `/painel/hotel/fnrh` implementa **somente o registro local de estadia**, com país/cidade de origem e horários de check-in/check-out. Exige reserva confirmada, chegada dentro do período e check-in anterior ao check-out. Impede registros repetidos. As ações de check-in e check-out também aparecem diretamente nas reservas confirmadas da operação hoteleira; o quarto passa a ocupado ao registrar a chegada e para limpeza ao registrar a saída.

Não gera, preenche nem transmite a FNRH oficial e não substitui o procedimento governamental. Não coleta documentos de identificação. Integração e homologação oficiais são uma etapa futura específica. O resumo operacional do painel é local e baseado em regras e contagens de reservas e situações de quartos; não envia dados de hóspedes a um serviço de IA.

## Arquitetura, banco e API

Uma aplicação Next.js em Node.js, com React/TypeScript no frontend, serviços em `server/`, Zod compartilhado em `lib/`, SQL parametrizado em SQLite e Better Auth para senhas/sessões. Não há Workers, D1 ou Drizzle.

```text
app/                       Rotas públicas, conta, painéis e adaptadores HTTP
app/painel/[module]/[[...section]]/_components/administration/ Visão geral e estilos da administração geral
components/platform/       Marca, seletor de módulos, catálogos, formulários e painéis
components/platform/hotel/ Visões do painel, gestão de quartos e registro local de estadias
components/platform/experiences/ Visão geral, passeios, guias e agenda de saídas
components/platform/administration/ Gestão de empresas e acessos na administração geral
components/platform/booking-management.tsx Reservas empresariais e consulta de vagas por saída
components/site/           Institucional, login e contatos existentes
lib/platform-schema.ts     Contratos Zod, rótulos, dinheiro e datas
lib/platform-navigation.ts Áreas do painel, navegação, aliases e escopo por tipo de empresa
server/platform-*.ts        Tipos, persistência, sessão e autorização
server/catalog-content-service.ts Gestão editorial, paginação administrativa e vínculo Cadastur
server/catalog-public-content-service.ts Consultas públicas do catálogo editorial
server/catalog-content-model.ts Conversão do modelo SQL para o contrato editorial
server/nearby-recommendations.ts Cache, ordenação e apresentação das proximidades
server/nearby/openstreetmap.ts Geocodificação, consulta Overpass e limites do provedor
server/cadastur/import-service.ts Prévia e confirmação transacional de importações Cadastur
server/cadastur/directory-service.ts Consulta, revisão e publicação dos registros Cadastur
server/platform-dashboard-service.ts Resumo agregado e autorizado da administração geral
server/business-panel-read-service.ts Composição tipada dos dados de leitura dos painéis empresariais
server/company-service.ts  Cadastro e métricas de empresas
server/company-membership-service.ts Vínculos de equipe, permissões e listagens administrativas
server/inventory-read-service.ts Consultas e listagens do inventário empresarial
server/inventory-write-service.ts Gravações de quartos, guias, passeios e saídas
server/booking-read-service.ts Consultas de reservas, estadias e resumos operacionais
server/booking-write-service.ts Solicitação, decisão, cancelamento e registro de estadias
server/notification-service.ts Caixa individual de avisos e entrega transacional
server/booking-email-operations-service.ts Resumo administrativo da fila de entrega de e-mails
server/booking-query.ts Consulta compartilhada de reservas enriquecidas
server/catalog-service.ts  Consultas públicas filtradas por publicação
server/booking-service.ts  Solicitações, decisões, disponibilidade e estadias
db/migrations/             Migrações SQL versionadas
scripts/                   Setup, senhas, migração, backup e restauração
tests/                     Testes de domínio, HTTP e prévia isolada
docs/openapi.json          Contrato HTTP servido em /api/openapi
infra/                     Exemplos para publicação futura
```

A migração aditiva `002_platform.sql` cria `companies`, `company_members`, `rooms`, `guides`, `tours`, `departures`, `bookings`, `stay_records` e `platform_audit`. Mantém as tabelas de contatos e autenticação. A migração `007_room_operations.sql` acrescenta a situação de limpeza/manutenção aos quartos, preservando os registros existentes como prontos. A migração `018_guide_member_assignment.sql` acrescenta a referência opcional ao perfil de guia e um índice único por operadora. A migração `019_user_notifications.sql` cria a caixa individual de avisos com vínculo à conta, empresa e reserva, deduplicação por evento e índice de consulta. A migração `022_booking_reminders.sql` acrescenta lembretes internos vinculados à conta, empresa e reserva, sem alterar reservas antigas ou habilitar envio SMTP. Chaves estrangeiras e índices apoiam escopo empresarial, consultas de reservas, disponibilidade e paginação do histórico. O histórico de auditoria guarda ator, empresa, ação, entidade e horário; não registra senhas nem corpos de requisições. Administradores podem consultar o registro em `/painel/plataforma/auditoria`, com filtro por empresa; a tela é somente leitura e apresenta as ações em português, inglês ou espanhol conforme o idioma selecionado.

As APIs públicas ficam em `/api/catalogo/*`; cadastro básico em `POST /api/conta/cadastro`; operação autenticada em `/api/plataforma/*`. O contrato OpenAPI descreve entradas, autenticação e erros. Datas de saída na API usam ISO UTC; a interface converte o horário de Manaus. Campos monetários na API usam centavos inteiros.

As listagens públicas `GET /api/catalogo/hospedagens` e `GET /api/catalogo/passeios` aceitam `?page=1` para consultar até 24 registros diretamente no banco. Essa forma retorna `data` e `meta` (`page`, `pageSize`, `total`, `totalPages`). Sem `page`, a API mantém a resposta completa existente para os clientes atuais.

## Segurança e recuperação

Antes de publicar uma empresa ou alterar seus campos públicos enquanto ela já está publicada, o administrador precisa confirmar que revisou os dados com o prestador. A API aplica a regra mesmo em chamadas diretas e grava `company.publish_confirmed` junto com a alteração na auditoria existente; a confirmação é transitória e não vira campo do cadastro nem exige migration.

O harness de integração falha antes de abrir banco se herdar `DATABASE_URL` ou `POSTGRES_URL`; o processo filho recebe somente o caminho SQLite temporário. A parada do worker de ensaio exige projeto Compose isolado, valida serviço/volume/rede e compara o estado de produção antes/depois. Consulte `REHEARSAL-SAFETY.md` antes de operar a stack temporária.

Validação no frontend/backend, listas fechadas de campos, autorização no servidor, identificação da conta pela sessão, origem obrigatória nos POSTs, corpo JSON limitado, SQL parametrizado, cookies HttpOnly/SameSite, idempotência e proteção contra sobreposição de reservas. A administração não confia em e-mails ou permissões enviados pelo cliente. Segredos, banco e backups ficam fora do Git. Esta release não altera migrations nem o schema PostgreSQL.

O SMTP é opcional. Quando configurado, o sistema envia confirmação de cadastro, permite reenvio do link, redefine senhas com token de 30 minutos e revoga sessões existentes após a redefinição; também envia aviso de senha alterada. A interface só oferece esses fluxos quando há SMTP. Sem SMTP, a administração pode recuperar uma conta pelo terminal com `npm run account:password -- EMAIL`; a senha é digitada e confirmada de forma oculta, verificada contra o hash e as sessões anteriores são encerradas. O comando não cria contas nem concede permissões. Confirme a identidade da pessoa antes da manutenção.

## Qualidade, operação e próximas etapas

Execute `npm run format:check`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` e `npm run test:integration`. A integração usa apenas banco temporário na porta 3100. `npm run qa:preview` mantém essa prévia aberta para revisão visual. O uso real permanece em `127.0.0.1:3005`.

Componentes responsivos, navegação por teclado, labels, foco visível, anúncios de erro/sucesso, estados vazios/carregamento e respeito a movimento reduzido foram incluídos. Páginas públicas possuem metadados e sitemap de registros publicados; áreas privadas são `noindex` e sem cache compartilhado. Catálogos dinâmicos refletem mudanças de publicação. As listas de reservas de turistas, operação e estadias FNRH, quartos, passeios, guias, saídas empresariais, vínculos de acesso, empresas e conteúdo editorial consultam até 20 registros por página; o diretório Cadastur também consulta 20 por página e permite busca. Os filtros de empresa em Acessos e Auditoria consultam opções no servidor, em blocos de 20, respeitando o escopo da conta. Os painéis usam contagens agregadas. Os endpoints de empresas, opções de empresa, acessos, conteúdo, Cadastur, reservas e inventário oferecem paginação; os contratos anteriores são mantidos nos endpoints que já existiam. Não houve teste de carga.

O workflow `.github/workflows/ci.yml` executa as verificações locais e sobe PostgreSQL 18 para validar isolamento empresarial e operações concorrentes de reserva. O resultado remoto depende de Actions habilitado no repositório. A versão 0.12.11 prepara a autorização da decisão de reserva para permanecer válida durante a transação; a homologação funcional isolada continua pendente. Replicação em nuvem, SMTP e inventário real de Maués continuam pendentes. Consulte `DEPLOY.md` e `VERIFICACAO.md`.

Próximas evoluções: configurar e homologar SMTP na VPS, permissões mais granulares por função, envio externo de avisos, política de cancelamento e reagendamento, integração oficial de FNRH e, caso autorizado, pagamentos. A decisão dessas regras precede a ampliação de escopo.
