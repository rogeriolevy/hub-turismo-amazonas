# Deploy na Vercel

## Estado atual

O deploy completo está bloqueado até a camada de persistência ser adaptada. Hoje o site usa better-sqlite3 em arquivo local para contas, sessões, reservas, contatos, Cadastur e chaves JWT; o painel também grava e remove imagens em public/uploads. As funções Node.js da Vercel têm filesystem somente leitura, exceto /tmp, que é temporário e não é compartilhado entre instâncias. Um deploy direto poderia falhar ao iniciar ou perder dados entre reinicializações e manter cópias divergentes em instâncias diferentes.

Por isso, o script encerra antes de enviar arquivos enquanto detectar SQLite local ou uploads no disco. Ele não troca o banco por /tmp nem publica uma versão que pareça guardar dados sem persistência. A própria Vercel recomenda banco/armazenamento externo para estado durável: [filesystem das funções](https://vercel.com/docs/functions/runtimes), [SQLite na Vercel](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel) e [armazenamento Vercel](https://vercel.com/docs/storage).

## O que precisa ser adaptado

1. Migrar as chamadas síncronas atuais de SQLite para uma base de dados gerenciada compatível com funções serverless. Essa mudança inclui Better Auth, migrations e os serviços da plataforma.
2. Mover uploads e exclusões de imagens do catálogo para um armazenamento de objetos, preservando as URLs e o controle de acesso.
3. Atualizar esta pré-checagem para reconhecer os adaptadores duráveis e validar as variáveis próprias deles.
4. Criar o projeto Vercel, configurar as variáveis por ambiente e publicar primeiro um Preview. Promover para produção após validar login, sessão, cadastro, contatos, imagens e reservas.

Como as consultas de dados são hoje síncronas e espalhadas pelos serviços, escolher a base gerenciada é uma decisão de arquitetura, não uma variável que um script consiga resolver sozinho. O provedor deve oferecer banco durável e conexão apropriada para funções. As imagens podem usar Vercel Blob ou outro armazenamento de objetos.

## Preparar as variáveis

Depois da migração, configure no projeto Vercel, para Preview e Production:

- SITE_URL: origem HTTPS exata do ambiente.
- BETTER_AUTH_SECRET: segredo aleatório de pelo menos 32 caracteres; mantenha-o estável entre deployments.
- ADMIN_EMAILS: lista das contas administradoras.
- TURNSTILE_SITE_KEY e TURNSTILE_SECRET_KEY: chaves reais do widget Turnstile autorizado para o domínio.
- As variáveis de conexão do banco e do armazenamento de imagens escolhidos.

Não envie .env.local, banco SQLite ou segredos no código. O JWT mantém chaves privadas na tabela jwks, então essa tabela também deve estar no banco durável.

As páginas de login, cadastro e conta são renderizadas por requisição para não inicializar Better Auth durante o prerender do build. Mesmo assim, `BETTER_AUTH_SECRET` (com pelo menos 32 caracteres) e `SITE_URL` precisam estar configurados nos ambientes Preview e Production para autenticação funcionar nas requisições.

## Executar o script

O script exige a Vercel CLI (npm install --global vercel) e autenticação (vercel login). Se a pasta ainda não estiver vinculada, iniciará vercel link. Depois que a pré-checagem de armazenamento permitir a publicação, ele confirma as variáveis e executa formatação, TypeScript, ESLint, auditoria das dependências de produção, testes unitários, build de produção e integração HTTP. Qualquer falha cancela o deploy; Preview é o destino padrão.

Comandos:

- npm run deploy:vercel — publica um Preview.
- npm run deploy:vercel -- production — publica em produção.

Atualmente os dois comandos terminam na pré-checagem de persistência, antes do login ou do envio de qualquer arquivo à Vercel. Depois de adaptar banco e imagens, o primeiro comando publica Preview; o segundo publica em produção.
