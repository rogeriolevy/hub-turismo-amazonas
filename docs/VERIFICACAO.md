# Verificação — versão Node.js + SQLite

Última atualização: 03/10/2026. Checkout: hub-turismo-amazonas-node. Publicação Sites preservada; esta versão está disponível apenas localmente.

## Resultados confirmados

| Verificação                                          | Resultado                                                                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Runtime Node.js e SQLite                             | Aprovado: Node 22.23.2, ABI 127                                                            |
| Instalação limpa pelo lockfile (npm ci)              | Aprovada em NTFS, Windows; 568 pacotes                                                     |
| Migração temporária                                  | Aprovada em banco descartável, sem acessar o banco local                                   |
| TypeScript                                           | Sem erros                                                                                  |
| ESLint                                               | Sem erros ou avisos                                                                        |
| Prettier                                             | Formatação aprovada                                                                        |
| Testes de serviços e operação                        | 49 aprovados, 0 falhas                                                                     |
| Build Next.js 16.3.4                                 | Aprovado com Webpack; preparação em NTFS e artefato copiado para `.next` no checkout FAT32 |
| Integração HTTP em servidor de produção isolado      | Aprovada; contatos, autenticação, Cadastur, reservas e isolamento entre empresas           |
| Saúde da aplicação e consulta administrativa anônima | HTTP 200 e HTTP 401, respectivamente                                                       |
| CI no GitHub Actions                                 | Não reexecutado nesta revisão                                                              |
| Auditoria npm de produção                            | Último resultado registrado: zero vulnerabilidades em 29/09/2026; não reexecutada          |

Os 49 testes atuais incluem validação, consentimento, SQL parametrizado, armazenamento, idempotência, limites de envio, erro consistente, autorização por correspondência exata, reabertura do banco, backup pelo comando operacional, restauração, Cadastur e operações da plataforma. O número substitui as contagens de 22 e 29 registradas em etapas anteriores do desenvolvimento.

O checkout está em uma unidade FAT32. O Turbopack falha ao criar junctions, e o Webpack também não consegue resolver os arquivos nativos nesse volume. `npm run build` agora detecta FAT32, prepara código e dependências em uma pasta NTFS temporária, migra um banco descartável e copia o artefato `.next` de volta. A integração foi executada a partir do checkout original usando esse artefato.

A integração HTTP valida páginas, formulário, conflito de idempotência, origem de requisição, cadastro genérico do provedor bloqueado, tentativa de falsificar identidade por cabeçalhos, login válido/inválido, usuário autenticado sem permissão (403), sessão administrativa, cookies HttpOnly/SameSite, paginação, logout com revogação e limite de tentativas.

## Verificação do relato de senha recusada

A conta rogerio1kg@gmail.com existe no banco configurado e tem uma credencial de senha. Os registros do servidor indicaram falha na comparação da senha, sem expor seu conteúdo. Não foi identificada uma divergência de banco nem reproduzida corrupção de acentos/símbolos na entrada por terminal. A causa da diferença na senha real permanece não confirmada; não houve leitura nem redefinição automática da senha do proprietário.

Foi corrigido o corte silencioso da entrada acima de 128 caracteres. A entrada agora mostra asteriscos, aceita Backspace/Ctrl+U e valida o comprimento completo. Criação e recuperação verificam a senha contra a credencial armazenada antes de confirmar sucesso. A tela oferece mostrar/ocultar senha, aviso de Caps Lock e distingue credenciais inválidas de origem não autorizada e indisponibilidade.

Os testes adicionais cobrem caracteres Unicode, símbolos, espaços, confirmação exata, entrada longa, cancelamento, bloqueio de entrada por pipe, autorização da manutenção de contas, redefinição e revogação de sessões. A integração HTTP usa senha com acentos/símbolos/espaços, redefine a senha com o servidor ativo e exige que a antiga e sua sessão sejam rejeitadas enquanto a nova dá acesso ao painel.

## Revisão no navegador

Login, consulta de contato fictício e logout foram executados com conta temporária isolada, inclusive após instalação limpa e mudança para o roteamento de atualização do Next.js. Também foi enviado um contato pela interface, conferidos o estado de sucesso e sua chegada ao painel. As credenciais e mensagens de teste não foram colocadas no banco de uso local.

Após os ajustes no fluxo de senha, o navegador confirmou os controles mostrar/ocultar, o login com a senha redefinida da conta temporária e o acesso aos contatos. O servidor local foi atualizado; o painel real foi deixado aberto com o e-mail autorizado e o campo de senha vazio, aguardando a redefinição privada pelo proprietário.

A revisão posterior usou quadros de 320, 375, 768 e 1280 pixels para início/contato, privacidade, login e caixa de contatos autenticada. Não houve excesso de largura do documento nessas combinações. A barra vertical do Windows reduziu a área útil em 15 pixels; a medição considera essa área. O ambiente temporário é iniciado por npm run qa:preview e não é incluído nas rotas da aplicação normal.

Foram ampliados campos e áreas de toque, reduzidos espaçamentos internos em cartões estreitos e ajustada a quebra de texto do seletor. No painel, os controles de atualização/paginação permanecem montados e informam indisponibilidade sem perder o foco durante o carregamento. Na revisão, Atualizar preservou o foco; o formulário focou o primeiro erro, anunciou/focou o sucesso e devolveu o foco ao nome após Enviar outra mensagem. A escolha do assunto também foi exercitada com as setas e Enter.

Os destinos do atalho Pular para o conteúdo receberam tabIndex=-1 para permitir foco direto no conteúdo principal. A revisão por largura não emula aparelhos, teclado virtual ou Safari móvel. A matriz completa de aparelhos físicos, zoom e leitores de tela permanece pendente; não se declara certificação de acessibilidade.

## Operação local

Foi criado o backup backups/hub-2026-09-29T15-13-35-299Z.sqlite do banco local, restaurado em arquivo temporário separado e verificado com quick_check e comparação de contagens das tabelas contacts, user, account e schema_migrations. A verificação passou; o arquivo temporário foi removido e o banco ativo não foi substituído. O roteiro de operação e recuperação está em docs/USO-LOCAL.md.

## Instalação e dependências

better-sqlite3 foi fixado em 12.11.1 após a instalação limpa da linha 13 exigir compilação nativa indisponível nesta máquina. A versão selecionada instalou seu binário e passou pelos testes. O lockfile foi regenerado e validado com npm ci. Drizzle ORM, Drizzle Kit, Wrangler e Vinext não integram a instalação final.

O instalador ainda emite avisos de descontinuação do ESLint 9 e de prebuild-install, utilizado pelo driver. Eles não são resultados de vulnerabilidade da auditoria; acompanhar atualização compatível dessas ferramentas.

## Segurança e limites

- Autenticação por biblioteca, sem senha padrão ou confiança nos cabeçalhos do Sites. Cadastro básico controlado não concede privilégios.
- Autorização no servidor, sessão revogada no logout e na recuperação administrativa de senha.
- Segredo aleatório em arquivo ignorado; banco, backups e dados temporários fora do Git.
- Verificação de origem, SQL parametrizado, transação atômica, limitação de corpo e rate limit.
- Cookies Secure configurados para HTTPS; TLS e configuração real do proxy dependem da hospedagem.
- CSP inclui unsafe-inline para compatibilidade com o build atual; não utiliza nonce estrito.
- Uma instância com SQLite em disco persistente. Sem teste de carga para múltiplos hotéis ou múltiplos servidores. As novas listas operacionais ainda não possuem paginação.

## Estado da entrega e pendências de ativação

A prévia utiliza http://127.0.0.1:3005 porque a porta 3000 já estava ocupada por outro serviço. Os comandos e exemplos desta versão usam 3005.

O banco local começou vazio, sem contas de teste. ADMIN_EMAILS está configurado para rogerio1kg@gmail.com e a conta real já foi criada pelo proprietário. A senha continua sob controle do proprietário; os testes de login e recuperação foram feitos com contas temporárias. O login do site publicado permanece independente.

O CI está definido em arquivo, mas não foi executado em GitHub Actions nesta entrega. Os exemplos de systemd/Nginx e o agendamento de backup não foram ativados. Permanecem pendentes a escolha da hospedagem, domínio, HTTPS, armazenamento externo de backup, informações reais do provedor no aviso de privacidade e eventual transferência de contatos da produção.

O proprietário informou VPS Hostinger e depois definiu que o trabalho deve continuar somente local por enquanto. Não foram solicitadas credenciais, acessado o servidor ou alterados DNS e publicação.

## Ampliação local 0.3.0

A migração 002 foi aplicada após backup consistente. Nenhuma empresa fictícia foi adicionada ao banco real. Os testes de domínio acrescentados cobrem isolamento de empresas, revogação, vínculos de recursos, sobreposição de hospedagens, capacidade de saídas, cancelamento, idempotência, datas, preço calculado no servidor, suspensão e sequência de estadias. A recuperação local foi ampliada para contas básicas, mantendo a proteção específica do comando administrativo e a revogação de sessões.

A integração HTTP agora também cobre cadastro básico real, recusa de campos de perfil, bloqueio de e-mail administrativo reservado, origem, login, criação de empresas/inventário/guias/passeios/saídas, aprovação e cancelamento, rotas privadas, tentativa de acesso entre empresas e revogação imediata de vínculo. Os testes anteriores de contatos permanecem.

As páginas protegidas redirecionam ao login. Quando o HTML já começou a ser transmitido pelo Next.js, redirecionamentos e páginas não encontradas podem usar resposta 200 com metadados de redirecionamento/noindex. As APIs mantêm os códigos 401, 403 e 404 correspondentes, sem exposição de dados privados.

No navegador, o cadastro de um quarto fictício confirmou persistência, preço em reais e estado de sucesso. O seletor de módulos e a marca contextual foram conferidos. Um turista autenticado solicitou um passeio pela interface e viu a pendência em Minhas reservas; a aprovação no painel alterou o estado para Confirmada e reduziu as vagas disponíveis de seis para cinco. A revisão de larguras 320/375/768/1280 não encontrou excesso horizontal em detalhes de hospedagem/passeio, cadastro, conta, empresas e agenda. Essa evidência é de quadros no navegador, não de aparelhos físicos.

Limites: sem confirmação de e-mail, notificações, pagamentos ou FNRH oficial. Guias e operadores compartilham permissões dentro da mesma empresa nesta versão; gestores e equipe hoteleira também. Antes de conceder vínculo, a administração deve confirmar diretamente a identidade e o controle da conta. Para ampliar a operação pública, implementar verificação/recuperação de e-mail e homologar permissões e regras com as empresas.
