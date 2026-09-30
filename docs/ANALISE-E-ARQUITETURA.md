> Documento histórico da versão Sites. Para a arquitetura Node.js atual, consulte PLANO-SIMPLIFICADO.md e README.md.

# Hub Turismo Amazonas: análise e arquitetura

Data: 28/09/2026. Escopo confirmado: site institucional com apresentação e formulário. O PMS operacional não faz parte desta entrega.

## Análise completa da referência

Fonte: Plano_Equipe_Hub_Inteligente_Turismo-1.pdf, 8 páginas. O documento é um plano acadêmico interno. Não comprova produto em produção, clientes, parceiros ou integrações homologadas.

| Página | Conteúdo e impacto                                                                                                                                                                                          |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | Protótipo PMS para hotéis/pousadas de Maués; período 26/09–09/10, parcial 07/10 e final 09/10. Orienta território e proposta; prazos acadêmicos não são promessas comerciais.                               |
| 2      | Núcleo: painel, acomodações, hóspedes, reservas, check-in/estadia/check-out, estados de quartos e resumo operacional. FNRH e IA são preparação/experimento. O site apresenta a proposta em desenvolvimento. |
| 2      | Passagens, pacotes, cooperativas, marketplace, pagamentos, chatbot avançado e MCP não bloqueiam o MVP. O site não oferece compras nem simula integrações reais.                                             |
| 3      | Sete frentes: produto, pesquisa, UX/UI, frontend, backend/banco, IA/FNRH e testes/documentação. Francisco é o líder; demais nomes indefinidos. Não foram inventados membros nem cargos públicos.            |
| 4      | Cronograma prioriza fluxo completo e congelamento em 06/10. Esta implementação institucional é independente do cronograma.                                                                                  |
| 5      | Kanban, uma tarefa principal por pessoa, critérios, evidências e checkpoints. Foram registrados resultados; não foram criados quadros ou enviados comunicados à equipe.                                     |
| 6      | Pronto exige integração, testes, ausência de falha crítica conhecida e verificação por outra pessoa. Verificações técnicas executadas; revisão humana independente permanece para a equipe.                 |
| 7      | Avaliações demonstram PMS e contribuições. O institucional não substitui o fluxo operacional da disciplina.                                                                                                 |
| 8      | Pauta da reunião e referências. São contexto, não autorização para criar reuniões, atribuir responsáveis ou contatar terceiros.                                                                             |

Lacunas: identidade oficial, razão social, dados formais, canais públicos, entrevistas, clientes e evidência de integrações não fornecidos. A redação evita inventá-los. O outro PDF da pasta foi preservado e não foi adotado como requisito.

## Requisitos e regras

Públicos: visitantes; gestores de hotéis/pousadas; parceiros; equipe autorizada.
RF01: apresentação, proposta, caminho e contato.
RF02: nome, e-mail, organização opcional, assunto, mensagem e autorização.
RF03: confirmação somente após persistência.
RF04: retentativa sem duplicidade.
RF05: aviso de privacidade sem publicidade ou analytics.
RF06: consulta restrita paginada com loading, vazio e erro.
RF07: contrato OpenAPI e saúde do banco.

Nome: 2–100 caracteres; e-mail válido até 254; organização até 120; assunto enumerado; mensagem 10–2.000; consentimento obrigatório. Corpo até 12.000 bytes. Honeypot vazio. Origin igual à origem do site. Limites: 5 novos envios/e-mail/hora e 30/IP/hora. Chave UUID v4 e conteúdo iguais recuperam protocolo; conteúdo diferente retorna 409. Nenhuma leitura pública de mensagens. ADMIN_EMAILS vazio nega todos os acessos administrativos.

## Arquitetura

Monólito modular: frontend, adaptadores HTTP, regras e infraestrutura separados no código; uma implantação Worker. Evita serviços distribuídos desnecessários.

Fluxo: navegador → React → API HTTP → serviço/validação → D1.
Administração: login ChatGPT verificado pelo dispatcher Sites → allowlist no servidor → API de consulta → D1.
O frontend institucional é renderizado no servidor. Formulário e caixa de mensagens usam componentes de cliente.

Stack: React 19, TypeScript, Vinext/Vite com API Next.js App Router, CSS responsivo, Shadcn/Radix, Zod, Cloudflare Workers, D1 SQLite e Drizzle para migrations. Node Test Runner, ESLint, Prettier e GitHub Actions. Versões exatas no lockfile.

Vinext está em beta e foi mantido por compatibilidade com Sites. Reavaliar maturidade e carga antes de uso comercial crítico. Não há chamada de IA nesta entrega nem necessidade de OPENAI_API_KEY.

## Estrutura de pastas

- app/: páginas, metadados, loading/erro/404 e adaptadores API.
- components/site/: marca, navegação, formulário e caixa de mensagens.
- components/ui/: primitivas acessíveis existentes no starter.
- lib/: validação compartilhada.
- server/: regras, autorização e respostas HTTP.
- db/: esquema e acesso ao D1.
- drizzle/: migrations SQL e metadados.
- build/ e scripts/: infraestrutura.
- .openai/: binding lógico e identidade da hospedagem.
- .github/workflows/: CI.
- tests/: regras, SQLite e smoke HTTP.
- docs/: análise, API e operação.
- public/: favicon e fotografia WebP.

Os PDFs originais foram preservados.

## Banco de dados

contacts: UUID, chave idempotente única, fingerprint SHA-256, nome, e-mail, organização, assunto, mensagem, consent_at, privacy_version e created_at.
rate_limits: chave derivada de escopo/janela/identificador, janela horária e contador.
Índices: chave idempotente única; data para ordenação; janela para limpeza.
Não existem dados de hóspedes, documentos, pagamentos ou reservas.
Hashes de controle de abuso são pseudônimos, não anonimização garantida.
Schema muda por migrations; consultas usam parâmetros D1. Limites antigos são limpos a cada envio, sem cron.
A equipe deve definir retenção e rotina de exclusão de contatos.

## APIs

Contrato em docs/openapi.json e GET /api/openapi.

- POST /api/contatos: público no app, respeita audiência privada/pública da hospedagem.
- GET /api/admin/contatos?page=1: identidade e e-mail autorizado, 20 itens/página.
- GET /api/health: verifica disponibilidade do banco/esquema.
  Erros: error.code, message, fields opcional, requestId. Status 400, 401, 403, 409, 413, 415, 422, 429 e 503.
  Timeout no navegador não prova falha no banco; retentativa conserva a chave idempotente.

## Segurança

- Sem credenciais no código; produção usa ambiente Sites. .env*, .dev.vars e estado local ignorados.
- Login delegado e autorização exata, no servidor e na API.
- Headers oai-authenticated-* só são confiáveis atrás do dispatcher Sites. Outra hospedagem exige substituir a autenticação; não expor diretamente este Worker confiando em headers de clientes.
- Validação dupla, limite de bytes, SQL parametrizado e escape React.
- Respostas pessoais sem cache; administração não indexável.
- CSP limita origens/objetos/formulários; inline ainda permitido para SSR. Nonce/hash é endurecimento futuro.
- Rate limit e honeypot reduzem abuso, mas não substituem WAF/CAPTCHA em ataque distribuído.
- Logs próprios omitem o conteúdo das mensagens.
- Revisão técnica não equivale a pentest ou certificação jurídica.

## UX/UI, acessibilidade, SEO e performance

Marca provisória: ondas Lucide remetem aos rios. Verde #103d30, azul #337b88 e dourado #f4c56c; fontes do sistema e Georgia em ênfases. Não é marca registrada/exclusiva.
Foto real perto de Manaus, sem atribuir a cena a Maués; crédito visível a Neil Palmer/CIAT sob CC BY-SA 2.0.
HTML semântico, pt-BR, skip link, foco, labels, aria-invalid/describedby, status e alertas; movimento reduzido.
Erros conservam os campos; sucesso muda o foco; área de contatos tem vazio/loading/erro.
SSR, JavaScript concentrado nas interações e WebP de 316.944 bytes com dimensões e prioridade de carregamento.
Metadados de título/descrição, canonical, Open Graph textual, sitemap e robots. Nenhum score Lighthouse foi inventado.

## Rastreabilidade das 25 etapas

| Etapas | Evidência                                                 |
| ------ | --------------------------------------------------------- |
| 1–2    | Análise de 8 páginas, RF01–RF07 e regras                  |
| 3–5    | Arquitetura, stack, separação de pastas                   |
| 6–8    | Frontend, serviço backend, D1 e migration                 |
| 9      | Login delegado, autorização negada por padrão             |
| 10–12  | OpenAPI, Zod, respostas consistentes                      |
| 13     | Loading, vazio, sucesso e erro                            |
| 14–17  | Layout responsivo, acessibilidade, SEO e imagem otimizada |
| 18     | 12 testes automatizados + smoke HTTP                      |
| 19–20  | Revisões técnica e visual; VERIFICACAO.md                 |
| 21–22  | Reuso, tipos estritos, ESLint e Prettier                  |
| 23     | Workflow CI e publicação versionada Sites                 |
| 24–25  | Worker, ambiente, operação e documentação                 |

Etapas relacionadas foram verificadas em blocos; não representam 25 implantações independentes.

## Limites e próximos passos

Não há PMS navegável, FNRH real, IA, pagamento ou marketplace. Formulário armazena mensagens; não envia e-mails automáticos.
O operador informado pelo responsável foi configurado no ambiente de produção. A autorização é aplicada no servidor, mediante login, e depende da publicação desse ambiente.
Próximos passos: testar o login do operador e definir canal de resposta; validar identidade/dados/aviso; escolher domínio e audiência; configurar monitoramento e rotina de backup; desenvolver PMS em projeto próprio com isolamento por hotel.
Referências primárias: https://developers.cloudflare.com/d1/worker-api/prepared-statements/ e https://github.com/cloudflare/vinext.
