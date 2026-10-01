# Navegação e transporte

Página pública: `/navegacao`, acessível no cabeçalho, no seletor de módulos e no sitemap. Inclui filtros combinados por origem, destino e modal, troca de sentido, estado vazio e limpeza. O quadro semanal tem controles próprios de sentido e dia. Os filtros selecionam informações cadastradas, não executam cotação em tempo real.

O módulo é informativo e não faz emissão de bilhetes, cobrança nem reserva de transporte. Não altera o banco ou cria fornecedores fictícios nos cadastros. A pesquisa foi feita em **01/10/2026**. Boa Vista corresponde a **Boa Vista do Ramos (AM)**, conforme esclarecido pelo usuário.

## Fontes e alcance

| Fonte                                                                                                                                                 | Informação incorporada                                                                            | Limite da verificação                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Navegam — busca enviada pelo usuário](https://navegam.com.br/busca?ida=2026-10-02&type=ida-volta&volta=2026-10-12&origem=1&destino=39&passageiros=1) | Manaus → Maués, F/B Almirante Dinelson, saída 02/10/2026 às 18h; passagem cheia de ida R$ 220.    | Confirmado na página e no modal de valores, sem avançar à compra. A pesquisa é de ida e volta, mas o preço pertence ao trecho de ida. Não atribuir esse valor a outras embarcações, datas ou sentidos.                             |
| [Navegam — Maués → Parintins](https://navegam.com.br/busca?ida=2026-10-02&type=ida&origem=39&destino=27&passageiros=1)                                | Trecho pesquisado, sob consulta.                                                                  | Não exibiu passagens para 02/10/2026. Não significa inexistência de serviço fora da plataforma.                                                                                                                                    |
| [Navegam — Maués → Boa Vista do Ramos](https://navegam.com.br/busca?ida=2026-10-02&type=ida&origem=39&destino=29&passageiros=1)                       | Trecho pesquisado, sob consulta.                                                                  | Não exibiu passagens para 02/10/2026. Sem preço, duração ou operador confirmados.                                                                                                                                                  |
| [Azul — Manaus → Parintins](https://passagens.voeazul.com.br/pt/voos-de-manaus-para-parintins)                                                        | Tarifa anunciada a partir de R$ 571, por pessoa, só ida em 25/11/2026.                            | Página oficial informa coleta nas últimas 48h e possibilidade de mudança e extras. Não foi feita reserva nem confirmado o horário do voo. Preços de resultados antigos do buscador foram descartados em favor da página carregada. |
| [Manaus Airport — Maués](https://airport-manaus.com.br/pt-br/destinos/maues)                                                                          | Maués consta como destino divulgado pelo aeroporto.                                               | Não confirma companhia, operação atual, frequência, duração ou tarifa. A página mostra a opção aérea como operação a verificar. Não foi confirmado voo direto de Maués a Parintins ou Boa Vista do Ramos.                          |
| [Billy Adventures — Maués Experience](https://billyadventure.com.br/produtos/maues-experience-g9mfa/)                                                 | Pacote de cinco dias e quatro noites, R$ 4.900 por pessoa e R$ 7.800 por casal.                   | Anúncio sem data de viagem. Traslado local não foi interpretado como passagem aérea ou fluvial até Maués. Confirmar condições com a agência.                                                                                       |
| Folha de Maués — cartaz enviado pelo usuário                                                                                                          | 14 horários semanais, nos dois sentidos, e telefones de PP, Almirante Dinelson I e Lady Cristina. | Sem publicação/validade identificável. Não foi feita confirmação por telefone. Original em `public/images/navegacao/roteiro-folha-de-maues.png`.                                                                                   |
| Navegação PP — cartaz enviado pelo usuário                                                                                                            | Corrobora os dez horários da PP e seus dois contatos; anuncia compra pelo WhatsApp.               | Sem tarifas e sem validade. Original em `public/images/navegacao/roteiro-navegacao-pp.png`.                                                                                                                                        |

Os identificadores de cidades da Navegam foram observados na seleção da própria página: Manaus 1, Maués 39, Parintins 27 e Boa Vista do Ramos 29. Os links preservam a consulta de referência; o viajante deve ajustar a data no fornecedor. O quadro de horários mantém as exceções de Manaus: sexta às 18h (Almirante Dinelson I) e sábado às 12h (Estrela PP III).

Também foram encontradas despesas governamentais de viagens, tabelas antigas e anúncios de festivais passados. Esses valores não foram usados como tarifas comerciais atuais. A pesquisa não obteve tabela pública atual para Maués → Parintins ou Boa Vista do Ramos.

## Manutenção

- Dados, fontes, contatos, horários e pacotes: `lib/navigation-data.ts`.
- Filtros e classificação temporal das tarifas: `lib/navigation.ts`.
- Interface interativa: `components/platform/navigation-explorer.tsx`.
- Página, metadados e estilos: `app/navegacao/`.
- Atualize a tarifa e sua fonte juntas, incluindo data da consulta, data da viagem, unidade e condições. Preço desconhecido deve continuar `null`, nunca zero ou estimativa não identificada.
- O servidor passa a data de Manaus à interface. Tarifas com viagem passada ou consulta há mais de 30 dias recebem “Referência histórica”; todos os preços continuam rotulados como referências sujeitas a alteração. Isso não substitui revisão editorial.
- Horários semanais não devem receber validade ou status de confirmação sem evidência. Preserve os cartazes como fonte e reconfirme os contatos antes de atualizações.
- Imagens são locais, sem carregamento de rastreadores ou imagens dos sites consultados. Links externos abrem com `noopener noreferrer`.

## Imagem do módulo

Ferramenta nativa de geração de imagens, modo de geração nova (`image_gen`), sem chave de API. Ilustração genérica, sem representar operador, embarcação ou voo real. Salva e comprimida em WebP em `public/images/navegacao/rios-e-ceus.webp`; o original gerado foi preservado fora do repositório. A página informa “Imagem ilustrativa gerada por IA”.

Prompt final:

> Use case: illustration-story. Asset type: wide website hero illustration for an Amazon regional transport travel portal. Primary request: a generic, symbolic illustration of river and air transport in Amazonas, Brazil. Scene: broad winding Amazon river with lush lowland rainforest, distant soft river islands, warm morning light. Subject: one traditional white two-deck regional passenger riverboat with modest green details and a small regional turboprop airplane in the distant sky. Style: sophisticated editorial travel illustration, softly textured painted shapes, restrained detail, warm cream, forest green, river teal and muted golden accents, calm welcoming atmosphere. Composition: wide panoramic landscape 3:2, the boat on the lower right and airplane upper right, spacious forest and river to the left; useful as the right panel of a website hero. No typography, no logos, no operator branding, no map labels, no watermark. This is a conceptual illustration, not documentation of any actual vessel, company or scheduled flight.

## Verificação

Testes cobrem filtros combinados, sentido da viagem, ausência de tarifa confirmada nos trechos regionais, exceções dos roteiros e classificação temporal. A integração HTTP verifica a página, o sitemap e os três arquivos de imagem. A interface deve ser revisada no navegador em desktop e celular após alterações.

Validação desta entrega: 45 testes aprovados; TypeScript, ESLint, Prettier, build de produção e integração HTTP aprovados. No navegador, foram verificados filtros combinados, estado vazio, limpeza, inversão, seleção de sexta/sábado e visualização em desktop e celular (390 px), sem transbordamento horizontal da página ou erros no console. O quadro tem rolagem própria para as colunas em telas pequenas.
