# Operação e deploy

## Sites

1. Executar tipos, lint, formatter, testes e build.
2. Gerar e revisar migrations; nunca reescrever SQL já aplicado.
3. Reutilizar project_id de .openai/hosting.json. DB é lógico; Sites conecta o banco real.
4. Configurar ADMIN_EMAILS com os operadores autorizados. O operador solicitado já foi configurado. Segredos pertencem ao ambiente, não ao código.
5. Sincronizar fonte para o repositório privado do Site com credencial temporária em memória.
6. Empacotar dist, drizzle e .openai/hosting.json. Excluir .env, .dev.vars, bancos locais, PDFs internos e node_modules.
7. Salvar versão do mesmo commit enviado e publicar preservando audiência. Site novo começa privado.
8. Aguardar status succeeded antes de informar publicação.
9. Abertura pública depende da escolha da equipe e definição do atendimento.

Migrations precedem o Worker: falha posterior pode deixar o banco atualizado. Rollback do código não restaura banco automaticamente.

## CI/CD

.github/workflows/ci.yml verifica lockfile, formatter, tipos, lint, testes e build; guarda artefato. Para executar automaticamente, o código precisa estar em GitHub com Actions habilitado; o repositório Sites não é automaticamente GitHub.
CD usa versões e deploy autenticado Sites. Não há token permanente nem produção não supervisionada configurados.
Outra hospedagem exige substituir a autenticação. Headers de identidade não podem ser aceitos diretamente do navegador.

## Banco local

npm run db:migrate:local aplica migrations pendentes e registra hashes numa tabela só local. Produção é controlada pelo Sites.
npm start executa o Worker compilado em loopback. O mock de login só existe em npm run dev.
Não reutilizar o SQLite local em produção.

## Monitoramento e recuperação

GET /api/health retorna 200 ou 503 sem revelar contatos.
Logs próprios usam requestId.
Configurar alertas externos depois de escolher o serviço.
Antes de mudança destrutiva, exportar backup pelo provedor e testar restauração separadamente.
Rollback: publicar uma versão anterior compatível com o schema atual. Banco exige plano separado.

## Habilitar a equipe

O e-mail solicitado foi configurado em ADMIN_EMAILS no ambiente da plataforma. Publicar para aplicar o ambiente e entrar em /admin usando a conta correspondente. Outras contas continuam sem autorização administrativa. Para trocar operadores, atualizar ADMIN_EMAILS e a lista de acesso do site, preservando o proprietário, e publicar novamente. O cadastro de uma conta, quando necessário, é feito pelo próprio operador.
