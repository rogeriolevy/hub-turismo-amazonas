# Diretório público do Amazonas

Atualização: 02/10/2026. Os conjuntos informados em `Dataset_Cadastur.txt` alimentam `/hospedagens`, `/gastronomia`, `/experiencias?tipo=guia`, `/agencias` e `/servicos`. Os guias do Cadastur aparecem no catálogo unificado de experiências junto a passeios e roteiros. A prioridade de exibição é Maués, Parintins, Boa Vista do Ramos e demais municípios do Amazonas. A busca ignora acentos e maiúsculas, aceita nome, município e tipo e combina o filtro de cidade. Em `/hospedagens`, o filtro estruturado **Tipo de hospedagem** usa o subtipo revisado do Cadastur.

## Dados e contatos

- Nome fantasia tem prioridade; nomes vazios, hífens ou asteriscos usam razão social/nome alternativo. Guias PF usam o nome do profissional. Sequências de CPF eventualmente incorporadas ao nome empresarial são removidas.
- Telefone e e-mail comerciais/institucionais, endereço comercial, site, idiomas e quantidades de unidades habitacionais/leitos são importados quando disponíveis. Endereço ausente, comum na aba de guias PF, é identificado como não informado. No detalhe público, mostramos apenas idiomas de atendimento para guias; não exibimos capacidade nem trimestre do cadastro.
- Telefones são normalizados para `tel:`, e-mails para `mailto:`. Sites aceitam somente HTTP/HTTPS sem credenciais. Links externos não são acessados pelo servidor. Não há confirmação de funcionamento de todos os sites ou contatos da base.
- CPF, nascimento, documentos pessoais, responsável e e-mail do administrador não podem ser mapeados. Contatos exigem `include_contacts: true`; os campos só aceitam cabeçalhos comerciais/institucionais correspondentes. O padrão da API continua sendo não importar contatos.
- Nenhuma conta, permissão, inventário ou reserva é criada pela importação. Ofertas próprias de hotéis publicados continuam disponíveis na seção “Reserve pela Hub”.

## Publicação e atualização

O painel `/painel/plataforma/cadastur` oferece seleção das seis categorias (incluindo transportadoras para uso administrativo), mapeamento dos contatos e a opção “Exibir no diretório público” por registro. Publicação exige revisão administrativa. Desmarcar a opção retira imediatamente o registro das páginas, do detalhe, do sitemap e da exportação.

Nova importação que modifica os dados ou o período retira a publicação e reabre a revisão, preservando vínculos com hotéis/guias existentes. Registros inalterados preservam seu estado. O lote anterior e as contas operacionais permanecem intactos.

As páginas públicas e `/prestadores/[id]` selecionam somente registros com `published=1`, `review_status='reviewed'` e UF AM. A exportação `/api/diretorio?categoria=hospedagens` (ou uma das outras quatro categorias) usa a mesma seleção e projeção de campos. Não expõe certificados, CNPJ, payloads administrativos ou vínculos internos.

### Comando de atualização

```powershell
npm run cadastur:sync -- --apply --publish
```

O comando exige um administrador existente em `ADMIN_EMAILS`, cria um backup consistente em `backups/cadastur-<data>.sqlite`, verifica sua integridade, aplica as migrações e baixa o recurso trimestral mais recente de cada conjunto pelo catálogo oficial CKAN. Guias PJ e PF são lidos em lotes separados. Somente AM é importado; cada lote imprime contagens e motivos de rejeição, sem células brutas ou documentos pessoais.

Use apenas `--apply` para importar mantendo as alterações em revisão interna. Sem `--apply`, o comando encerra sem alterar dados. Uma falha encerra a execução, preservando os lotes já concluídos; a reexecução identifica registros inalterados. A opção `--publish` publica apenas inclusões/alterações daquela execução, sem reativar registros inalterados que tenham sido ocultados pelo administrador.

## Fontes e diárias

A importação de 01/10/2026 publicou 2.721 registros do segundo trimestre de 2026: 478 hospedagens, 477 estabelecimentos de gastronomia, 583 guias (17 PJ e 566 PF), 1.091 agências e 92 serviços especializados. Nove linhas com nome/município inválido ficaram fora da seleção. Maués tem 42 registros, Parintins 104 e Boa Vista do Ramos 23, totalizando 169 na região destacada. Essas contagens representam cadastros por atividade, não negócios únicos.

Backup anterior à migração/importação: `backups/cadastur-2026-10-01T20-32-18-424Z.sqlite`, criado pela API de backup do SQLite e verificado com `integrity_check`. A verificação posterior retornou integridade `ok` e nenhuma violação de chave estrangeira. A conta administrativa existente foi preservada e nenhuma empresa operacional foi criada.

Os cinco conjuntos do MTur consultados usam licença ODbL 1.0. As páginas públicas exibem uma atribuição compacta com links para a fonte, licença e dados abertos (JSON). Datas de consulta editorial e indicadores de capacidade/período cadastral não aparecem nos cards nem nos detalhes para visitantes. A API e os dados administrativos preservam esses campos de origem; as fontes são referências trimestrais, sem validação cadastral em tempo real.

Os cards editoriais de hospedagem são independentes das identidades importadas, para não associar estabelecimentos por nome aproximado:

| Hospedagem           | Informação em 01/10/2026                                                                                                                                                              | Fonte                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Hotel Miramar, Maués | Diárias sob consulta; apartamentos Luxo/Suíte Master, ar-condicionado, Wi-Fi, café regional. Telefone do site e e-mail comercial do Cadastur.                                         | [Site oficial](https://www.hotelmiramarmaues.com.br/)                         |
| Icamiabas Parintins  | Preço inicial anunciado de R$ 330/noite, impostos/taxas à parte; Wi-Fi e estacionamento gratuitos, entrada 13h/saída 12h. Não é uma cotação garantida para outras datas ou ocupações. | [Motor de reservas do hotel](https://book.omnibees.com/chain/5131/hotel/9046) |

Preços não são deduzidos do Cadastur. Sem referência de tarifa, os cards indicam “Diárias sob consulta” ou “Pacotes sob consulta”. Imagens não verificadas de empresas não são usadas: os módulos têm símbolos genéricos de sua categoria.

### Pesquisa complementar e filtros de hospedagem

Consulta das fontes indicadas em `Hoteis_Pousadas_Informações.txt`, em 02/10/2026:

| Fonte                                                                                                                | Informação observada                                                                                                                                                                                                                                                                                                                                              | Uso e limite                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Tripadvisor — Maués](https://www.tripadvisor.com.br/Tourism-g2344878-Maues_State_of_Amazonas-Vacations.html)        | Separa hotéis, pousadas, restaurantes e atrações; oferece mapa e avaliações.                                                                                                                                                                                                                                                                                      | Boa referência de navegação. Ranking e preços dependem de parceiros, datas, localização e preferências; não copiar como dado fixo.                                            |
| [Conhecendo Maués](https://www.conhecendomaues.com.br/)                                                              | Organiza conteúdo de como chegar, onde hospedar, atrações, contatos úteis e eventos; destaca Maresia, Avenida Antártica e cultura local.                                                                                                                                                                                                                          | Referência editorial para conectar estadia, deslocamento e o que fazer; confirmar textos e eventos antes de publicar.                                                         |
| [Hotéis na Amazônia — Maués](https://www.hoteisnaamazonia.com.br/maues/)                                             | Lista Hotel Letícia, WR Pousada, Ribamar Palace, Pousada Jamilly, Hotel Francisco Gabriel, Pousada Wáikyru, Dorzane Palace e Pousada Marupiara, com tipos, comodidades e endereços.                                                                                                                                                                               | A página não mostra data clara de revisão. Tratar como lista de contatos para validar; não importar telefones ou presumir funcionamento.                                      |
| [Booking — Pousada Irmãos Perrone](https://www.booking.com/hotel/br/pousada-irmaos-perrone-maues3.pt-br.html)        | A ficha apresenta quartos com ar-condicionado, Wi-Fi, opção familiar e banheiro privativo. A página de resultados consultada mostrava 7,9/10 com 13 avaliações.                                                                                                                                                                                                   | Comodidades, nota, quantidade de avaliações e tarifa podem mudar. Não registrar preço ou nota sem consulta datada à plataforma ou integração autorizada.                      |
| [Skyscanner — hotéis em Maués](https://www.skyscanner.com.br/hoteis/brasil/maues-hotels/ci-27549232)                 | Filtros de Wi-Fi, animais, tipo de acomodação e perfil da viagem; ordenação por custo-benefício, avaliações, preço e estrelas.                                                                                                                                                                                                                                    | Inspira filtros do produto, mas cada filtro exige campo próprio, preenchido e atualizado pela hospedagem ou fonte autorizada.                                                 |
| [No Ar — opções hoteleiras em Maués](https://noarportal.com.br/descubra-as-opcoes-hoteleiras-no-municipio-de-maues/) | Cita Hotel Miramar, Ribamar Palace e Dorzane Palace. Para o Miramar, informa 35 apartamentos, categorias Luxo/Suíte Master, ar-condicionado, frigobar, TV, lavanderia, 110 V e passeios fluviais; o [site do próprio hotel](https://www.hotelmiramarmaues.com.br/) confirma as categorias e comodidades e acrescenta Wi-Fi, gerador e serviço de quarto 24 horas. | O texto jornalístico serve como descoberta. A ficha pública do Miramar usa informações confirmadas no site próprio; conferir novamente dados operacionais antes de atualizar. |

#### Critérios para a evolução do catálogo

- **Disponível agora:** busca textual por nome/cidade/subtipo, município e subtipo oficial do Cadastur. O filtro de tipo combina com a cidade, mantém o critério na paginação e não altera as ofertas operacionais “Reserve pela Hub”.
- **Próxima camada de dados próprios:** comodidades estruturadas (por exemplo, Wi-Fi, ar-condicionado, café da manhã, estacionamento, acessibilidade e aceita animais), declaradas pelo responsável e com data de revisão. Não extrair filtros de frases livres sem validação.
- **Busca de estadia:** entrada, saída e hóspedes devem consultar quartos ativos, capacidade e disponibilidade real da Hub. Mostrar preço de oferta direta com unidade, ocupação, período e taxas claramente descritos; não usar tarifas sem datas das plataformas externas.
- **Avaliações e mapa:** avaliações precisam ser coletadas pela própria Hub ou por integração autorizada, com fonte, nota e quantidade de avaliações. Distâncias exigem coordenadas verificadas; não estimar a partir de endereço textual.
- Os nomes adicionais encontrados nos diretórios de terceiros são **pistas de pesquisa**, não ofertas publicadas. Antes de incluí-los na operação, validar identidade, contato institucional, comodidades, endereço, situação atual e autorização do responsável.

## Implementação e verificação

- Migração `005_public_directory.sql`: amplia categorias, adiciona contatos e publicação, preserva IDs/lotes/vínculos e expira prévias antigas. Reconstrução transacional com verificação das chaves estrangeiras antes do commit.
- `server/cadastur/public-directory.ts`: seleção pública, prioridade regional, busca, paginação e fonte.
- `components/platform/provider-directory.tsx`: abas, cards, detalhes, filtros e diárias pesquisadas.
- `scripts/cadastur-sync.ts`: importação reproduzível com backup e publicação explícita.
- Testes cobrem migração de dados preexistentes, contatos comerciais, campos bloqueados, publicação/revogação, atualização, filtros, paginação, nomes mascarados, URLs inseguras e fluxo HTTP administrativo/público. Os testes usam dados fictícios isolados e não consultam a rede do MTur.

Os textos indicados pelo usuário foram removidos: aviso geral de pesquisa/contratação em Navegação, selos “Proposta do MVP” e o parágrafo sobre solicitações sob os cards da página inicial. Permanecem as datas/fontes específicas necessárias para interpretar preços e horários.
