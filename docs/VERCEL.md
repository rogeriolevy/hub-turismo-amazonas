# Deploy na Vercel

## Armazenamento por ambiente

O projeto suporta dois ambientes sem exigir uma conta Vercel durante o desenvolvimento:

- **Local (`localhost:3005`)**: sem `DATABASE_URL` ou `POSTGRES_URL`, usa SQLite em `data/hub.sqlite`; sem `BLOB_READ_WRITE_TOKEN`, grava imagens em `public/uploads/catalog`.
- **Vercel**: exige `DATABASE_URL` ou `POSTGRES_URL` para PostgreSQL e `BLOB_READ_WRITE_TOKEN` para imagens no Vercel Blob. Sem a conexão do banco, a aplicação falha com uma mensagem de configuração em vez de tentar gravar no disco efêmero.

Se essas variáveis forem adicionadas manualmente ao ambiente local, o app também passa a usar PostgreSQL e/ou Blob localmente. Para manter o modo padrão local, não copie as variáveis de produção para `.env.local` (por exemplo, com `vercel env pull`). `DATABASE_PATH` pode apontar para outro arquivo SQLite local.

As rotas públicas de hospedagens, gastronomia, experiências, agências, serviços e navegação estão implementadas. A escolha do armazenamento agora é feita pela configuração do processo; não são rotas exclusivas da Vercel.

## Preparar o projeto Vercel

1. Configure o Root Directory como raiz do repositório (`./`) e Framework Preset **Next.js**. Não informe Output Directory personalizado.
2. Conecte ou crie um PostgreSQL compatível com `pg` e disponibilize `DATABASE_URL` ou `POSTGRES_URL` no ambiente Preview e Production.
3. Crie um Vercel Blob Store e disponibilize `BLOB_READ_WRITE_TOKEN` nos mesmos ambientes.
4. Configure as variáveis de autenticação e proteção listadas abaixo para Preview e Production.
5. Publique primeiro um Preview e valide autenticação, cadastro, diretórios, contatos, imagens e reservas antes de promover para produção.

O `vercel.json` define o build como `npm run db:migrate:postgres && npm run build`. A migração cria/atualiza as tabelas do Better Auth e aplica, em ordem, as migrações SQL próprias do projeto antes do Next.js. Não execute a migração ao mesmo tempo em múltiplos processos de build para o mesmo banco; o script usa advisory lock PostgreSQL.

## Variáveis necessárias

Configure em **Vercel → Settings → Environment Variables**:

- `DATABASE_URL` **ou** `POSTGRES_URL`: conexão PostgreSQL do ambiente.
- `BLOB_READ_WRITE_TOKEN`: token do Blob Store usado para gravar e remover imagens.
- `SITE_URL`: origem HTTPS exata do ambiente, sem caminho.
- `BETTER_AUTH_SECRET`: segredo aleatório de pelo menos 32 caracteres, estável entre deployments.
- `ADMIN_EMAILS`: lista de e-mails administradores.
- `TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY`: chaves Turnstile reais e autorizadas para os domínios publicados.

Não inclua `.env.local`, arquivos SQLite, backups nem segredos no Git. O JWT guarda as chaves em `jwks` no mesmo banco durável da autenticação.

## Dados existentes

Aplicar as migrações cria as tabelas; não copia o conteúdo de `data/hub.sqlite` para o PostgreSQL. Portanto, contas, sessões, empresas, reservas, contatos, registros Cadastur e catálogo local não aparecem automaticamente no banco Vercel. A transferência de dados é uma etapa separada e deve ser planejada com backup e validação, especialmente por envolver credenciais e dados pessoais. O schema novo poderá iniciar vazio e os dados públicos do Cadastur deverão ser importados para esse banco antes de aparecerem nos diretórios.

Imagens salvas depois da configuração do Blob recebem URLs do Blob. Arquivos que já existem em `public/uploads/catalog` permanecem locais; não são transferidos automaticamente.

Para iniciar um banco novo sem copiar contas e dados pessoais, `npm run admin:create` pode criar o administrador diretamente no PostgreSQL selecionado pela variável de conexão. Depois, `npm run cadastur:sync -- --apply` importa a base pública do Amazonas para o banco selecionado; ele usa SQLite quando não há URL PostgreSQL no ambiente. Os registros ficam para revisão; acrescente `--publish` somente se quiser publicar todos os registros importados sem revisão individual.

## Script de deploy

O script exige Node.js 22.13+ (linha 22), Vercel CLI e autenticação via `vercel login`. Se necessário, inicia `vercel link`, verifica as variáveis do ambiente selecionado e então executa format check, TypeScript, ESLint, auditoria de dependências de produção, testes, build e integração HTTP. Qualquer falha cancela o envio. O Preview é o destino padrão.

```powershell
npm run deploy:vercel
npm run deploy:vercel -- production
```

O deploy direto pela Vercel também executa a migração declarada em `vercel.json`. A etapa não cria os recursos nem define segredos: PostgreSQL, Blob e as variáveis devem estar configurados no projeto antes do build.

## Fontes oficiais

- [Runtime e filesystem das funções Vercel](https://vercel.com/docs/functions/runtimes)
- [Vercel Blob — armazenamento de arquivos](https://vercel.com/docs/storage/vercel-blob)
- [Better Auth — PostgreSQL](https://better-auth.com/docs/adapters/postgresql)
- [Better Auth — migrações programáticas](https://better-auth.com/docs/concepts/database#programmatic-migrations)

## Limites ainda não verificados

O checkout local não possui conexão com o PostgreSQL/Blob de Preview ou Production, e não foram realizadas credenciais nem publicação. Assim, a migração foi revisada no código, mas o schema precisa ser aplicado e exercitado num PostgreSQL real antes de considerar o deploy validado. Consulte os Function Logs da Vercel se uma função continuar retornando a página genérica de erro.
