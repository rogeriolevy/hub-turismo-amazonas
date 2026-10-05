# Publicar no Render

Este projeto é um servidor Next.js com páginas dinâmicas e APIs. No Render, crie um **Web Service** (não um Static Site) conectado ao repositório.

## Configuração do serviço

- **Root Directory**: deixe vazio para usar a raiz do repositório, onde estão `package.json`, `app/`, `db/` e `server/`. Se o painel estiver apontando para outra pasta, esses arquivos ficam fora do serviço.
- **Build Command**: `npm ci && npm run build`
- **Start Command**: `npm start`
- **Health Check Path**: `/api/health`
- **Node**: linha 22, conforme `package.json` e `.nvmrc`.

O comando `npm start` agora mantém `127.0.0.1:3005` no computador local. No Render, a variável `RENDER=true` faz o servidor escutar em `0.0.0.0` e usar a porta definida por `PORT`. O Render encaminha as requisições públicas somente para um servidor que escuta em `0.0.0.0` na porta do serviço.

Na inicialização do Render, o app executa as migrações no banco selecionado antes de iniciar o Next.js. Isso ocorre no processo do serviço, depois de montar o disco persistente; não coloque a migração SQLite no Build Command ou Pre-deploy Command, pois esses comandos executam em outra instância.

## SQLite persistente

O padrão local é `data/hub.sqlite`. No Render, para conservar o banco entre deploys e reinicializações, conecte um Persistent Disk ao Web Service e configure:

- **Mount Path**: `/var/data`
- **Environment Variable**: `DATABASE_PATH=/var/data/hub.sqlite`

Não tente montar um disco em `/` ou na raiz do código (`/opt/render/project/src`); o Render não permite esses mount paths. Use um diretório como `/var/data`. O arquivo SQLite pode estar no disco persistente, mas somente uma instância do serviço deve usá-lo. Persistent Disks exigem um plano pago no Render; sem disco, a aplicação pode iniciar, mas o SQLite local é efêmero e não deve guardar dados de produção.

Se preferir Render Postgres, configure `DATABASE_URL` ou `POSTGRES_URL`; o inicializador executa as migrações correspondentes. Sem essas URLs, ele mantém SQLite. Evite configurar as duas opções ao mesmo tempo para não escolher um banco diferente do pretendido.

## Variáveis de ambiente

Configure no serviço, mantendo os valores secretos fora do Git:

- `SITE_URL`: endereço HTTPS do serviço ou domínio.
- `BETTER_AUTH_SECRET`: segredo aleatório de pelo menos 32 caracteres.
- `ADMIN_EMAILS`: e-mail(s) autorizados como administrador.
- `TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY`: chaves reais para o domínio publicado.
- `DATABASE_PATH`: caminho no disco persistente se usar SQLite, ou URL PostgreSQL se usar Postgres.

## Se a página `/` ainda não abrir

Confira nos logs de deploy se o serviço iniciou sem erro de migração e se o log do Next.js indica a porta esperada. A página inicial existe em `app/page.tsx`; um erro de acesso externo pode ser o host/porta do processo, enquanto “package.json não encontrado” costuma indicar **Root Directory** incorreto. Para diferenciar essas falhas, envie o erro exato dos logs e o Root Directory configurado no painel.

## Limitações

O banco persistente não preserva automaticamente os arquivos de imagem salvos em `public/uploads/catalog`; eles ficam no filesystem do serviço. Configure uma forma de armazenamento persistente de imagens antes de depender desses uploads em produção. As migrações criam as tabelas, mas não transferem automaticamente o conteúdo do SQLite local para o serviço Render.

## Referências oficiais

- [Root Directory e arquivos disponíveis ao serviço](https://render.com/docs/monorepo-support)
- [Porta e host exigidos pelo Web Service](https://render.com/docs/web-services#port-binding)
- [Persistent Disks e restrições de mount path](https://render.com/docs/disks)
- [Limites dos comandos de deploy e pre-deploy](https://render.com/docs/deploys)
