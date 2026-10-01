# Cadastur — pesquisa e proposta de integração

Pesquisa inicial em 29/09/2026. Este documento preserva o histórico e o escopo da primeira implementação (v0.4.0). **A evolução de 01/10/2026 acrescenta contatos comerciais, agências, serviços e publicação do diretório do Amazonas. As regras e instruções atuais estão em [Diretório público](DIRETORIO-PUBLICO.md).** Referências abaixo a etapas futuras ou campos bloqueados descrevem o escopo anterior.

## Conclusão

Para a Hub Turismo Amazonas, empresa privada, recomenda-se usar os **dados abertos do Ministério do Turismo**, com descoberta de arquivos pela API de catálogo CKAN quando acessível e alternativa de importação de arquivo oficial. O resultado será consultado no SQLite local da Hub.

A API transacional Cadastur existe no Conecta GOV.BR, mas o programa informa explicitamente que não oferece acesso direto ao setor privado. Portanto, uma conta GOV.BR ou um cadastro no Cadastur não bastam para habilitar essa API. Fontes: [API Cadastur no catálogo oficial](https://www.gov.br/conecta/catalogo/apis/cadastur-cadastro-de-prestadores-de-servicos-turisticos) e [perguntas frequentes do Conecta](https://www.gov.br/governodigital/pt-br/infraestrutura-nacional-de-dados/interoperabilidade/conecta-gov.br/conecta-gov-br).

## Fontes por módulo

| Dados procurados                     | Fonte oficial                                                                                                   | Destino proposto na Hub                                                           |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Hotéis, pousadas e albergues/hostels | [Meios de Hospedagem](https://dados.turismo.gov.br/pt_BR/dataset/meios-de-hospedagem)                           | Catálogo `/hospedagens`; vínculo posterior com empresa do painel hoteleiro        |
| Guias                                | [Guia de Turismo](https://dados.turismo.gov.br/pt_BR/dataset/prestadores-de-servicos-turisticos-guia-turismo_2) | Diretório `/guias` a criar; perfis `/guias/[slug]`; vínculo opcional com operador |
| Bares, restaurantes e cafeterias     | [Restaurantes, Cafeterias e Bares](https://dados.turismo.gov.br/pt_BR/dataset/restaurantes-cafeterias-e-bares)  | Novo catálogo `/gastronomia`, separado dos passeios                               |
| Transporte turístico                 | [Transportadora Turística](https://dados.turismo.gov.br/pt_BR/dataset/transportadora-turistica)                 | Novo catálogo `/transportes`; subtipo navegação quando identificado na fonte      |

O enquadramento de albergues como meio de hospedagem também aparece na [relação de atividades do MTur](https://www.gov.br/empresas-e-negocios/pt-br/empreendedor/quero-ser-mei/cadastro-de-atividade-turistica-cadastur/cadastur). A categoria fina (hotel, pousada, hostel, modalidade de transporte) deverá ser mapeada a partir de campo existente no arquivo ou revisão administrativa; não será deduzida somente pelo nome.

As bases abrangem prestadores cadastrados, não todos os negócios de uma cidade. O conjunto de alimentação informa que o cadastramento dessa atividade é opcional. Transporte turístico não deve ser apresentado como inventário completo de linhas regulares, voos ou horários de barcos. Para ampliar a cobertura será necessário identificar outras fontes específicas.

O portal oferece séries por trimestre. Foram identificados recursos do segundo trimestre de 2026 nos catálogos de hospedagem, guias e alimentação. Isso representa um retrato publicado, não uma confirmação cadastral em tempo real. Exemplo: [recurso de hospedagens do segundo trimestre de 2026](https://dados.turismo.gov.br/pt_BR/dataset/meios-de-hospedagem/resource/7e385ec2-57d8-446c-9cc0-f5f7dadd1fdf).

## APIs identificadas

### API de catálogo CKAN — candidata para localizar os arquivos

Base divulgada pelo [portal de dados do MTur](https://dados.turismo.gov.br/dataset/?tags=Cadastur): `https://dados.turismo.gov.br/api/3`.

Requisições previstas conforme a [documentação oficial do CKAN](https://docs.ckan.org/en/2.9/api/):

```http
GET /api/3/action/package_show?id=meios-de-hospedagem
GET /api/3/action/package_show?id=prestadores-de-servicos-turisticos-guia-turismo_2
GET /api/3/action/package_show?id=restaurantes-cafeterias-e-bares
GET /api/3/action/package_show?id=transportadora-turistica
```

`package_show` retorna metadados e recursos de um conjunto. A integração deverá selecionar o período desejado, validar o endereço de download e ler o arquivo CSV/XLS/XLSX correspondente. Esse endpoint não é uma busca direta por estabelecimentos de uma UF. A filtragem por Amazonas/município ocorrerá na importação ou na base local. Não foi confirmada a disponibilidade de `datastore_search` para esses recursos.

**Verificação efetuada em 29/09/2026:** os endpoints CKAN das quatro categorias responderam HTTP 200 nesta implementação. Os quatro XLSX do segundo trimestre de 2026 foram baixados e lidos com sucesso. As tentativas anteriores haviam terminado por timeout; a tela agora trata indisponibilidade e oferece envio manual. A fonte continua sujeita à disponibilidade do MTur. A importação automática exige licença `odc-odbl`, formatos CSV/XLSX, HTTPS e o domínio exato `dados.turismo.gov.br`; redirecionamentos são recusados.

### API Cadastur no Conecta — referência, fora do caminho inicial

O [visualizador Swagger indicado](https://www.gov.br/conecta/catalogo/apis/cadastur-cadastro-de-prestadores-de-servicos-turisticos/swagger.json/swagger_view) e seu [JSON](https://www.gov.br/conecta/catalogo/apis/cadastur-cadastro-de-prestadores-de-servicos-turisticos/swagger.json) responderam HTTP 200 em 29/09/2026. Swagger 2.0, serviço versão 1.0.0. Há duas operações:

```http
POST https://apigateway.conectagov.estaleiro.serpro.gov.br/api-cadastur/v1/pessoa-juridica/obter-dados-atividade-pj
POST https://apigateway.conectagov.estaleiro.serpro.gov.br/api-cadastur/v1/guia-pessoa/obter-pessoa
```

O corpo `ParametroVO` contém `cpfCnpj`, `clientId` e `clientSecret`. Não há operação de listagem por UF neste Swagger. A ausência de `securityDefinitions` no JSON não significa acesso anônimo. O catálogo Conecta descreve autorização institucional e credenciais; a política do programa não oferece acesso direto ao setor privado. Não foram enviadas consultas de pessoas nem pedidos de credenciamento. A integração implementada usa dados abertos, sem credenciais Conecta.

## Uso local

Acesse `/painel/plataforma/cadastur` com o administrador já configurado em `ADMIN_EMAILS`.

1. Escolha Hospedagens, Guias, Gastronomia ou Transportes.
2. Clique em **Consultar arquivos do MTur** e selecione o período. Alternativamente, envie um arquivo oficial CSV/XLSX ou cole um CSV. Arquivos XLS antigos precisam ser convertidos para XLSX.
3. Clique em **Ler colunas**. Em guias, escolha a aba PJ ou PF e leia novamente após trocar a aba. Cada aba gera uma importação independente.
4. Confira o mapeamento sugerido, o período e os filtros. O padrão é Amazonas; município é opcional, com correspondência exata sem diferenciação de acentos/maiúsculas.
5. Clique em **Gerar prévia**. Confira inclusões, atualizações, registros inalterados, duplicatas, conflitos, rejeições e linhas fora do recorte. A amostra e as ocorrências exibem no máximo 100 itens; os totais abrangem toda a seleção.
6. **Confirmar importação** grava todos os registros válidos da seleção em uma transação. Linhas rejeitadas não bloqueiam as válidas. Nenhuma empresa ausente do arquivo é apagada.
7. Revise os registros no diretório interno. Hospedagens podem ser ligadas a uma empresa hoteleira já existente; guias, a um perfil já existente. Gastronomia e transportes ficam em revisão interna por enquanto.

Importação, revisão e vínculo não criam contas, concedem permissões, publicam prestadores ou habilitam reservas. Dados operacionais editados na Hub são preservados. A próxima etapa é a apresentação pública por módulo, com origem e período visíveis e publicação administrativa explícita.

A sugestão de nome para exibição prioriza **Nome Fantasia**. Quando o valor estiver vazio ou for um hífen, usa a razão social/nome alternativo selecionado. Sem coluna de nome fantasia, usa o nome disponível; guias pessoa física continuam identificados pelo nome do profissional. A prévia, a listagem e a busca utilizam esse nome. Para corrigir registros de importações anteriores, leia novamente a fonte, confira o mapeamento e confirme uma nova prévia: o nome fantasia não pode ser recuperado de uma coluna que não foi armazenada. O vínculo não substitui o nome editado da empresa na Hub.

## Estrutura e armazenamento

- `lib/cadastur-schema.ts`: categorias, tipos, validações e sugestão de colunas.
- `server/cadastur/sources.ts`: catálogo CKAN e download oficial com limites.
- `server/cadastur/file-worker.mjs` e `files.ts`: leitura isolada de CSV/XLSX.
- `server/cadastur/service.ts`: prévia, deduplicação, confirmação, revisão e paginação.
- `components/platform/cadastur-panel.tsx`: fluxo administrativo, feedback e tabela responsiva.
- `db/migrations/003_cadastur.sql`: migração aditiva, sem modificar as anteriores.
- `cadastur_imports`: administrador, fonte, período, SHA-256 do arquivo, resumo, validade e payload da prévia.
- `cadastur_entries`: categoria + certificado/CNPJ como chave única; nome, UF, município, tipo, situação/validade cadastral, fonte, período, revisão e vínculos opcionais.
- `platform_audit`: confirmação de importação e revisão.

Prévia válida por 30 minutos, vinculada ao administrador. Criar outra prévia invalida a anterior desse administrador. Payloads expirados são limpos na próxima criação de prévia; confirmação limpa seu payload imediatamente. Não há tarefa agendada. O arquivo bruto permanece somente em memória durante a leitura e não é gravado pelo aplicativo. Uploads manuais guardam origem declarada; somente downloads feitos pelo servidor são marcados como obtidos diretamente do MTur.

Novas referências reabrem a revisão, preservando os vínculos. Referências mais antigas são ignoradas. A confirmação confere novamente as versões da base; se outra importação a modificou, exige nova prévia. Repetir a confirmação do mesmo lote não duplica registros. Campos opcionais sem mapeamento ficam vazios: confira sempre o mapeamento ao atualizar uma referência.

## APIs locais

Todas exigem sessão administrativa. POST exige `Origin` da instalação. Respostas usam `{ data }` ou o erro padronizado `{ error: { code, message, requestId } }`.

| Método | Rota                                                           | Finalidade                                                                  |
| ------ | -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| GET    | `/api/cadastur/fontes?category=hospedagens`                    | Arquivos trimestrais CSV/XLSX recentes da categoria                         |
| GET    | `/api/cadastur/registros?category=hospedagens&page=1&q=Manaus` | Diretório, 20 registros/página e histórico                                  |
| POST   | `/api/cadastur/inspecionar`                                    | Abas, colunas, quantidade de linhas e checksum; sem retornar células brutas |
| POST   | `/api/cadastur/prever`                                         | Prévia normalizada persistida, ainda sem alterar o diretório                |
| POST   | `/api/cadastur/confirmar`                                      | Confirmação por `{ id }` de prévia                                          |
| POST   | `/api/cadastur/revisar`                                        | Revisão por `{ id, company_id?, guide_id? }`, vínculos anuláveis            |

Inspeção/prévia recebem JSON com `resource_id` oficial ou multipart com `file` e `config` (JSON em texto). Configuração da prévia: categoria, período `2026-T2`, UF, município opcional, nome da aba, índices de colunas e checksum da inspeção. Contrato detalhado em `docs/openapi.json` e `/api/openapi`.

## Limites e segurança

- Sessão e autorização conferidas antes de ler upload ou consultar fonte externa.
- Somente HTTPS no domínio oficial; recursos resolvidos no catálogo da categoria. Nenhuma URL arbitrária aceita na API. Timeout de rede: 25 segundos.
- Arquivo até 20 MB; multipart até 20 MB + 24.000 bytes. CSV UTF-8 ou Windows-1252, delimitador vírgula, ponto e vírgula ou tabulação. Células/linhas têm limites.
- Até 100 mil linhas, 100 colunas e 10 abas. Até 10 mil registros selecionados por prévia; reduza o recorte por município se necessário.
- XLSX: inspeção da descompactação em streaming, até 160 MB descompactados e 1.000 entradas. Leitura em worker, com heap limitado a 512 MB e timeout de 30 segundos; uma leitura por processo de cada vez. Fórmulas/macros não são executadas.
- Apenas campos cadastrais selecionados são persistidos. Colunas de CPF, e-mail, telefone, endereço, nascimento, documentos pessoais e responsável são bloqueadas no mapeamento. Identificadores iguais ao CPF da mesma linha são rejeitados.
- O certificado dos guias PF pode ter 11 dígitos e não deve ser confundido apenas pelo comprimento com CPF. O arquivo real do Amazonas foi conferido sem copiar documentos pessoais para a base operacional.
- Dados importados são renderizados como texto. SQL parametrizado, gravação transacional, prevenção de atualização concorrente, auditoria e ausência de publicação automática.
- Dados abertos não comprovam disponibilidade, preço, capacidade, situação atual, titularidade da conta ou parceria comercial. A licença ODbL precisa acompanhar futura redistribuição; não é a licença do código da Hub.

## Verificação dos arquivos reais

XLSX do segundo trimestre de 2026, filtrados por AM em banco de teste em memória. Sem gravação de prestadores reais no banco do usuário nesta entrega:

| Categoria / aba | Linhas AM | Aptas à prévia | Rejeitadas |
| --------------- | --------: | -------------: | ---------: |
| Hospedagens     |       483 |            478 |          5 |
| Guias PJ        |        17 |             17 |          0 |
| Guias PF        |       566 |            566 |          0 |
| Gastronomia     |       478 |            475 |          3 |
| Transportadoras |       151 |            151 |          0 |

As rejeições de hospedagens/alimentação exigem revisão de nome/município/UF. São registros da fonte, não uma contagem auditada de negócios únicos ou parceiros Hub. A amostra automatizada de XLSX em `tests/fixtures/cadastur-ficticio.xlsx` contém somente dados fictícios; testes de CI não dependem da rede do MTur.

## Testes e próximos passos

Testes cobrem CSV/XLSX e múltiplas abas, privacidade dos campos, filtro, deduplicação/conflitos, certificado de guia, idempotência, períodos antigos, concorrência, expiração, preservação do conteúdo operacional, vínculos válidos, origem HTTP, tamanho/tipo, checksum e 401/403. Rodar `npm test`, `npm run test:integration`, `npm run lint`, `npm run typecheck` e `npm run build`.

Próximos passos: realizar a primeira importação administrativa desejada; revisar a classificação e os vínculos; desenvolver publicação do diretório em hospedagens/guias e páginas de gastronomia/transportes, com regras claras de origem, licença e adesão. Agendamento automático e validação cadastral em tempo real não foram ativados.
