# Plano simplificado — Hub Turismo Amazonas

Data: 29/09/2026. Primeira entrega: site institucional e painel de contatos. Ampliação autorizada nesta data: catálogos, contas, reservas por aprovação e painéis locais. O detalhamento vigente está em [PLATAFORMA.md](PLATAFORMA.md).

## Objetivo e limites

Preservar a identidade visual, conteúdo, acessibilidade, formulário e consulta administrativa existentes. Executar uma aplicação Next.js oficial em Node.js, com SQLite em disco e SQL parametrizado, sem Cloudflare Workers, D1, Drizzle ou Vinext.

Esta versão é desenvolvida no checkout `hub-turismo-amazonas-node`, separado do checkout e da publicação Sites existentes. A produção atual não é alterada. A ampliação inclui reservas, quartos, turistas, guias, passeios e registros locais de estadia. Avaliações, pagamentos, IA e integração oficial de FNRH continuam fora do escopo.

## Arquitetura

Uma aplicação e um processo de publicação. Interface em `app/` e `components/`; regras de negócio e autenticação em `server/`; persistência em `db/`; operação em `scripts/` e `infra/`. As rotas HTTP chamam serviços, sem SQL no navegador. Banco acessível somente pelo servidor.

React e TypeScript são preservados. Next.js executa páginas e APIs em Node.js. SQLite usa `better-sqlite3` e migrações SQL versionadas. Better Auth administra senhas e sessões. Zod valida entradas nos dois lados. A autorização administrativa é verificada no servidor em cada consulta.

## Entregas e critérios de aceite

| Etapa | Entrega                             | Critério de conclusão                                                                                                                      |
| ----- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | Base Node.js e interface preservada | Build de produção, tipagem e páginas institucional/privacidade/admin funcionam sem dependências Cloudflare                                 |
| 2     | Contatos e SQLite                   | Envio válido persiste, duplicação é evitada, entradas inválidas são recusadas e mensagens sobrevivem à reabertura do banco                 |
| 3     | Acesso administrativo               | Administrador criado pelo operador local; cadastro básico não concede privilégios; login/logout funcionam e contatos são restritos         |
| 4     | Qualidade e operação                | Testes de serviços e HTTP, revisão no navegador, lint/formatter, migração, backup e restauração verificados; documentação e CI atualizados |

Responsável técnico nesta execução: Codex. Responsável pela definição da senha administrativa, escolha de hospedagem e ativação final: proprietário do projeto. A sequência acima define dependências; não representa uma estimativa de prazo contratual.

## Funcionalidades e regras

- Contato público com nome, e-mail, organização opcional, assunto, mensagem e consentimento.
- Limites de tamanho, honeypot, origem autorizada, chave de idempotência e limitação de envios.
- Mensagens e consentimento persistidos; respostas por e-mail continuam manuais.
- Painel paginado, atualização e estados de carregamento, vazio, erro e sucesso.
- Administrador inicialmente autorizado: `rogerio1kg@gmail.com`. Saber o e-mail não concede acesso; exige credencial válida criada por procedimento local. Nenhuma senha padrão ou senha de ChatGPT será reutilizada.
- Cadastro público básico pela rota controlada /cadastro, sem permissões empresariais. Administradores são provisionados pelo terminal; a recuperação de qualquer conta também depende de manutenção local segura, sem serviço de e-mail.

## Segurança e infraestrutura

Segredos por variáveis de ambiente; arquivos `.env`, banco e backups fora do Git e de `public/`. Sessões HttpOnly e SameSite, cookies Secure em HTTPS, verificação de origem e autorização no servidor. SQL parametrizado, limites de corpo e rate limit persistido. Não registrar senhas, cookies ou conteúdo de mensagens nos logs.

Hospedar uma única instância Node.js com disco local persistente, HTTPS, proxy configurado para sobrescrever o cabeçalho de IP confiável e backups externos. Não colocar o SQLite em armazenamento efêmero ou pasta compartilhada de rede. Automatizar backup consistente e testar restauração. Escala com vários servidores exige reavaliar o banco.

## Impacto da migração

Reutilizar páginas, identidade, componentes, schemas Zod e contrato dos contatos. Substituir adaptador D1, scripts de execução, migrações e login delegado do Sites. A conta autenticada do site publicado não migra automaticamente. Não copiar sessões ou credenciais do site atual.

Publicação futura exige escolher hospedagem e endereço, cadastrar a senha administrativa, configurar HTTPS/disco/backups e, se houver contatos em produção, transferi-los com validação de contagens e consentimentos. Só trocar o endereço divulgado após validar a nova instalação. Manter a publicação anterior disponível para retorno durante a transição.

## Verificação

Serviços: validação, persistência, idempotência, limites e SQL parametrizado. HTTP: login/logout, cadastro bloqueado, autorização, origem, paginação e formatos de erro. Navegador: contato, painel, navegação por teclado e viewport estreita. Operação: migração repetível e restauração de backup em banco separado. Evidências e pendências serão registradas em `docs/VERIFICACAO.md`.

## Situação da execução

As etapas 1 a 3 da entrega local estão concluídas. Na revalidação de 03/10/2026, passaram runtime Node/SQLite, instalação limpa no NTFS, migração temporária, 49 testes, integração HTTP, build de produção, TypeScript, ESLint e Prettier. O build em Windows detecta checkout FAT32 e usa uma cópia de preparação NTFS; o artefato foi copiado de volta e a integração passou a partir do checkout original. As contagens de 22 e 29 testes descritas em registros anteriores foram substituídas pela contagem atual de 49.

A revisão anterior no navegador inclui larguras simuladas de 320, 375, 768 e 1280 pixels, além de verificações de teclado, foco após validação/envio e atualização de contatos. Um backup do banco local foi restaurado e conferido em arquivo separado. Esses testes manuais não foram repetidos nesta revalidação.

A conta administrativa já foi criada. A documentação e o CI foram preparados. O proprietário informou possuir VPS Hostinger, mas decidiu manter esta etapa somente local, deixando domínio, sistema da VPS e publicação para depois. O uso diário e a recuperação estão descritos em docs/USO-LOCAL.md.

A matriz de aparelhos físicos, leitores de tela e zoom do navegador continua pendente de homologação específica; a revisão por largura não equivale a essa certificação. O site publicado não foi alterado.

## Ampliação da plataforma

A versão 0.3.0 implementa os módulos solicitados com reservas pendentes de aprovação, isolamento por empresa e migração aditiva. O vídeo de alternância orientou a marca contextual e o seletor de módulos. O banco de uso permanece sem empresas fictícias. Consulte PLATAFORMA.md para sequência de cadastro, matriz de permissões, limites de FNRH, modelo de dados e próximas evoluções. A operação permanece somente local.
