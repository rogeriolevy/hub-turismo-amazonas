# Verificação da entrega

Data: 28/09/2026. Escopo: site institucional, contato persistente e consulta administrativa. O PMS apresentado no PDF permanece uma etapa futura.

## Evidências executadas

- 12 testes automatizados passaram: validação, consentimento, persistência em SQLite real, idempotência e concorrência, conflito de chave, limites por e-mail/IP, entradas com conteúdo SQL, formato/tamanho/origem da requisição, autorização fechada por padrão, erros sem vazamento e uso de índices.
- Smoke HTTP passou para página inicial, privacidade, administração, saúde do banco, OpenAPI, robots, sitemap e página inexistente. Também verificou respostas 401, 422 e 403 nos casos esperados.
- Verificação de tipos, lint, formatter e compilação foram executados com sucesso, inclusive na rodada final após os ajustes de apresentação e documentação.
- Auditoria das dependências de produção retornou zero vulnerabilidades conhecidas no momento da execução. Isso não equivale a uma auditoria completa de segurança.
- Navegador local: formulário preenchido e enviado, confirmação de sucesso exibida e mensagem consultada na área administrativa após login de desenvolvimento. Dados fictícios ficaram apenas no banco local.
- A página administrativa sem login exibiu a opção de autenticação; a API sem login retornou 401.
- Revisão visual em desktop e em viewport de celular de 390 × 844. A largura útil observada foi 375 px com barra de rolagem, sem transbordamento horizontal. Campos e textos legíveis; contraste da introdução do formulário corrigido. Captura local em test-results/mobile-contact.png, fora do versionamento.

## Acesso solicitado

O e-mail administrativo informado pelo responsável foi configurado em ADMIN_EMAILS no ambiente Sites e incluído na lista de visitantes autorizados, preservando o proprietário. A aplicação concede a permissão administrativa somente após autenticação e correspondência exata com essa variável. A permissão de visitante da plataforma, isoladamente, não concede acesso às mensagens.

O login real da conta solicitada ainda não foi realizado pelo operador. O teste local usa exclusivamente a identidade simulada de desenvolvimento. Nenhuma senha foi criada ou armazenada.

## Publicação e conferência

O componente local de publicação do Sites voltou a ficar disponível em 28/09/2026, após uma interrupção na preparação. As configurações de acesso foram preservadas na plataforma. A publicação aplica ADMIN_EMAILS ao Worker e a migration ao banco de produção.

Executar o fluxo descrito em DEPLOY.md com o project_id existente. Não criar outro site. Confirmar status succeeded antes de considerar a versão disponível e solicitar ao operador que faça o primeiro login. O resultado da publicação e o endereço são informados na entrega; este documento registra os testes feitos antes da publicação.

O site mantém a audiência restrita ao proprietário e ao operador convidado. A abertura ao público é uma decisão posterior, independente da autorização administrativa da aplicação.

## Limites da revisão

Sem ensaio de carga, auditoria WCAG formal, pentest externo, restauração de backup ou teste com a conta real em produção. Estados vazio, carregando e erro estão implementados; não foram todos induzidos visualmente nesta rodada. Não há notificação automática por e-mail, analytics ou integrações PMS/FNRH/IA. Definir retenção dos contatos, canal de atendimento, domínio e audiência antes do lançamento público.
