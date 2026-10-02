# Plataforma local — módulos e operação

Versão 0.5.0, 02/10/2026. Escopo autorizado: ampliar a instalação Node.js/SQLite com catálogos, contas e painéis. As reservas são **solicitações sujeitas à aprovação do hotel ou operador**, sem cobrança online. O site institucional e a caixa de contatos permanecem disponíveis. A publicação anterior no Sites é independente.

## Rotas e permissões

| Área             | Rotas                                                                                                                                            | Quem acessa                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Institucional    | `/`, `/sobre`, `/privacidade`                                                                                                                    | Público                                              |
| Hospedagens      | `/hospedagens`, `/hospedagens/[slug]`                                                                                                            | Público; solicitar exige login                       |
| Passeios e guias | `/passeios`, `/passeios/[slug]`, `/guias/[slug]`                                                                                                 | Público; solicitar exige login                       |
| Acesso           | `/entrar`, `/cadastro`                                                                                                                           | Visitantes; contas autenticadas seguem para sua área |
| Turista          | `/minha-conta`, `/minha-conta/reservas`                                                                                                          | Conta autenticada; somente suas reservas             |
| Hotel            | `/painel/hotel`, `/painel/hotel/quartos`, `/painel/hotel/reservas`, `/painel/hotel/fnrh`                                                         | Gestor/equipe vinculados ao hotel ou administrador   |
| Operador         | `/painel/passeios`, `/painel/passeios/passeios`, `/painel/passeios/guias`, `/painel/passeios/agenda`, `/painel/passeios/vagas`                   | Guia/operador vinculados à empresa ou administrador  |
| Administração    | `/painel/plataforma`, `/painel/plataforma/empresas`, `/painel/plataforma/acessos`, `/painel/plataforma/cadastur`, `/painel/plataforma/conteudos` | Administrador definido em `ADMIN_EMAILS`             |
| Contatos         | `/painel/contato` (`/admin` redireciona para esta rota)                                                                                          | Administrador definido em `ADMIN_EMAILS`             |

`/painel/passeios/reservas` também abre a lista de solicitações. A empresa em atendimento é selecionada pelo campo do painel; o parâmetro `?empresa=UUID` nunca concede autorização por si só. Endereços não previstos exibem a página de recurso não encontrado.

O menu principal mantém os links dos módulos também após o login; a conta autenticada aparece pelo avatar. O seletor **Alternar módulo** reúne a conta e os painéis autorizados. A administração pública dos conteúdos dos catálogos fica em **Conteúdos dos catálogos**.

## Primeiro uso pelo administrador

1. Entre em `http://127.0.0.1:3005/entrar` com a conta administrativa existente. A senha permanece a definida localmente.
2. Abra **Minha conta → Administração geral → Empresas**. Cadastre um hotel/pousada ou operador como rascunho. O endereço curto usa letras minúsculas, números e hífens; o tipo da empresa não pode ser trocado depois.
3. Para delegar a operação, peça à pessoa que crie sua conta em `/cadastro`. Confirme diretamente que ela controla a conta: esta etapa não envia confirmação de e-mail. Em **Contas e permissões**, vincule o e-mail à empresa e ao perfil correto.
4. No painel hoteleiro, cadastre cada quarto físico com código, nome, capacidade e diária. No painel de passeios, cadastre os guias, os passeios e suas saídas com data, horário de Manaus e capacidade.
5. Volte a **Empresas** e altere a situação para **Publicado**. Passeios e perfis de guia também têm seu próprio controle de publicação. Quartos e saídas precisam estar ativos para novas solicitações.
6. Um turista entra no catálogo, solicita e acompanha a resposta em **Minhas reservas**. A empresa aprova ou recusa no seu painel.

O diretório público contém referências do Cadastur e conteúdos revisados pela Hub. Na administração, **Conteúdos dos catálogos** permite cadastrar, editar, ilustrar, publicar, deixar como rascunho e remover itens de hospedagens, gastronomia, passeios, guias, agências, serviços turísticos e navegação. Na revisão do Cadastur, **Completar perfil com informações e imagens** cria um complemento editorial ligado ao registro oficial. Remover esse complemento preserva o registro oficial; sua publicação é controlada pela revisão do Cadastur. A exportação de dados do Cadastur continua usando os campos da fonte oficial. Veja [diretório público](DIRETORIO-PUBLICO.md) para as categorias e atribuição de fonte.

### Nome fantasia nas listagens

Em **Empresas**, mantenha a razão social ou nome cadastrado e preencha **Nome fantasia** com o nome pelo qual o estabelecimento é conhecido. O nome fantasia tem prioridade nos catálogos, painéis, seletores de empresa, permissões e reservas. Se ficar vazio, o nome cadastrado continua sendo exibido. A busca de hospedagens aceita os dois nomes, e a ordenação usa o nome exibido. Nomes de hóspedes, guias, quartos e passeios mantêm seus próprios campos.

A migração `004_company_trade_name.sql` acrescenta o campo sem alterar nomes ou registros existentes. Antes de usar esta atualização, faça backup e execute `npm run db:migrate`. Na API de empresas, `name` mantém o nome cadastrado e `trade_name` é opcional: omitir o campo numa atualização preserva seu valor; enviar texto vazio remove o nome fantasia.

## Modelo de autorização

- Todo cadastro público cria somente uma conta básica. Campos extras, como `role`, são recusados. E-mails reservados à administração não podem ser cadastrados pela rota pública.
- O administrador cria empresas, publica/suspende, concede/revoga vínculos e pode operar todos os módulos. Saber seu e-mail não concede acesso: é necessária uma sessão autenticada.
- `hotel_manager` e `hotel_staff` podem operar quartos, reservas e estadias da empresa vinculada. Nesta etapa possuem as mesmas capacidades operacionais; nenhum dos dois concede permissões ou lê contatos gerais.
- `operator` e `guide` podem operar guias, passeios, agenda e reservas da empresa vinculada. Nesta etapa o guia é um membro da equipe do operador, sem limitação por passeio individual. O perfil público do guia e sua conta de acesso são registros distintos.
- A mesma conta pode integrar mais de uma empresa. Permissões são consultadas no servidor a cada operação. Revogação e suspensão retiram imediatamente o acesso empresarial nas próximas requisições; reservas pessoais continuam acessíveis.
- Não há atribuição de administrador pela interface. Esse perfil depende da configuração local protegida.

## Reservas e disponibilidade

Estados: `pending` (aguardando aprovação), `confirmed`, `declined` e `cancelled`. A pendência não bloqueia quarto nem retém vagas. A confirmação revalida a disponibilidade em uma transação SQLite `IMMEDIATE`, evitando duas aprovações concorrentes incompatíveis.

Hospedagens aceitam períodos de 1 a 30 noites, a partir da data atual em Manaus, respeitando a capacidade do quarto. A saída de uma reserva pode coincidir com a entrada de outra. Cada registro de quarto representa uma unidade física, não um estoque de uma categoria.

Cada quarto também possui uma situação operacional: `ready` (pronto), `cleaning` (em limpeza) ou `maintenance` (em manutenção). A ocupação é derivada de uma reserva confirmada com check-in registrado e sem check-out; não pode ser marcada manualmente. O check-out muda o quarto automaticamente para limpeza. A equipe o libera para novas solicitações ao marcá-lo como pronto. Quartos em limpeza ou manutenção não aparecem como disponíveis no catálogo e não aceitam novos pedidos nem check-in até voltarem ao estado pronto.

Passeios têm uma saída futura, capacidade e preço por pessoa. A soma das pessoas em reservas confirmadas não pode exceder a capacidade. Uma saída com solicitações pendentes/confirmadas não pode mudar de passeio ou horário; crie outra saída. Não é permitido reduzir a capacidade abaixo das confirmações existentes.

Valores são calculados no servidor, em centavos, e registrados na solicitação: diária × noites ou valor por pessoa × participantes. Alterar o preço do catálogo não muda os pedidos existentes. O valor é uma referência da solicitação; esta versão não recebe pagamentos.

O turista pode cancelar sua própria solicitação pendente/confirmada antes do início da atividade ou de um check-in registrado. Isso libera capacidade confirmada. Uma solicitação já analisada não aceita uma segunda decisão. Há limite de 20 novas solicitações por conta a cada 24 horas e idempotência por conta/chave UUID. O painel atual não possui reagendamento, cancelamento pela empresa de uma confirmação, reembolsos ou notificações automáticas.

## Estadias e FNRH

A rota `/painel/hotel/fnrh` implementa **somente o registro local de estadia**, com país/cidade de origem e horários de check-in/check-out. Exige reserva confirmada, chegada dentro do período e check-in anterior ao check-out. Impede registros repetidos. As ações de check-in e check-out também aparecem diretamente nas reservas confirmadas da operação hoteleira; o quarto passa a ocupado ao registrar a chegada e para limpeza ao registrar a saída.

Não gera, preenche nem transmite a FNRH oficial e não substitui o procedimento governamental. Não coleta documentos de identificação. Integração e homologação oficiais são uma etapa futura específica. O resumo operacional do painel é local e baseado em regras e contagens de reservas e situações de quartos; não envia dados de hóspedes a um serviço de IA.

## Arquitetura, banco e API

Uma aplicação Next.js em Node.js, com React/TypeScript no frontend, serviços em `server/`, Zod compartilhado em `lib/`, SQL parametrizado em SQLite e Better Auth para senhas/sessões. Não há Workers, D1 ou Drizzle.

```text
app/                       Rotas públicas, conta, painéis e adaptadores HTTP
components/platform/       Marca, seletor de módulos, catálogos, formulários e painéis
components/site/           Institucional, login e contatos existentes
lib/platform-schema.ts     Contratos Zod, rótulos, dinheiro e datas
server/platform-*.ts        Tipos, persistência, sessão e autorização
server/company-service.ts  Empresas, vínculos, inventário, agenda
server/catalog-service.ts  Consultas públicas filtradas por publicação
server/booking-service.ts  Solicitações, decisões, disponibilidade e estadias
db/migrations/             Migrações SQL versionadas
scripts/                   Setup, senhas, migração, backup e restauração
tests/                     Testes de domínio, HTTP e prévia isolada
docs/openapi.json          Contrato HTTP servido em /api/openapi
infra/                     Exemplos para publicação futura
```

A migração aditiva `002_platform.sql` cria `companies`, `company_members`, `rooms`, `guides`, `tours`, `departures`, `bookings`, `stay_records` e `platform_audit`. Mantém as tabelas de contatos e autenticação. A migração `007_room_operations.sql` acrescenta a situação de limpeza/manutenção aos quartos, preservando os registros existentes como prontos. Chaves estrangeiras e índices apoiam escopo empresarial, consultas de reservas e disponibilidade. O histórico de auditoria guarda ator, empresa, ação, entidade e horário; não registra senhas nem corpos de requisições.

As APIs públicas ficam em `/api/catalogo/*`; cadastro básico em `POST /api/conta/cadastro`; operação autenticada em `/api/plataforma/*`. O contrato OpenAPI descreve entradas, autenticação e erros. Datas de saída na API usam ISO UTC; a interface converte o horário de Manaus. Campos monetários na API usam centavos inteiros.

## Segurança e recuperação

Validação no frontend/backend, listas fechadas de campos, autorização no servidor, identificação da conta pela sessão, origem obrigatória nos POSTs, corpo JSON limitado, SQL parametrizado, cookies HttpOnly/SameSite, idempotência e proteção contra sobreposição de reservas. A administração não confia em e-mails ou permissões enviados pelo cliente. Segredos, banco e backups ficam fora do Git.

O comando `npm run admin:password -- EMAIL` continua restrito à lista administrativa. Para recuperar uma conta de turista/equipe, o responsável com acesso ao terminal pode executar `npm run account:password -- EMAIL`. A senha é digitada e confirmada de forma oculta, verificada contra o hash e as sessões anteriores são encerradas. O comando não cria contas nem concede permissões. Confirme a identidade da pessoa antes da manutenção. Não existe recuperação automática por e-mail nesta fase.

## Qualidade, operação e próximas etapas

Execute `npm run format:check`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` e `npm run test:integration`. A integração usa apenas banco temporário na porta 3100. `npm run qa:preview` mantém essa prévia aberta para revisão visual. O uso real permanece em `127.0.0.1:3005`.

Componentes responsivos, navegação por teclado, labels, foco visível, anúncios de erro/sucesso, estados vazios/carregamento e respeito a movimento reduzido foram incluídos. Páginas públicas possuem metadados e sitemap de registros publicados; áreas privadas são `noindex` e sem cache compartilhado. Catálogos dinâmicos refletem mudanças de publicação. Consultas de reservas usam índices; as novas listas ainda não têm paginação e devem ser reavaliadas com crescimento do volume. Não houve teste de carga.

O CI existente executa as verificações locais correspondentes, mas ainda precisa rodar em um repositório com Actions habilitado. A VPS Hostinger permanece fora desta entrega. Para publicar depois, será necessário configurar domínio/HTTPS, processo Node, disco persistente, backup externo, verificação/recuperação de e-mail e homologar os fluxos com as empresas. Consulte `DEPLOY.md` e `VERIFICACAO.md`.

Próximas evoluções: imagens reais e edição de perfil, paginação/filtros operacionais, permissões mais granulares por função, avisos de aprovação, política de cancelamento e reagendamento, recuperação por e-mail, auditoria visível, integração oficial de FNRH e, caso autorizado, pagamentos. A decisão dessas regras precede a ampliação de escopo.
