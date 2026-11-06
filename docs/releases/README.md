# Registro de releases

Use esta estrutura para registrar cada entrega pequena, delimitada por domínio. Os campos entre colchetes são valores a coletar para a release em questão: confirme-os a partir de evidências atuais e não copie hashes, contagens ou resultados de saúde de outra versão. A nota [0.12.18](0.12.18.md) registra a publicação mais recente; a [0.12.13](0.12.13.md) permanece como exemplo histórico.

## Checklist do autor

- [ ] Identificar domínio, escopo, resultado esperado e requisitos atendidos.
- [ ] Referenciar o plano GSD e as verificações executadas, com resultados e limites observados.
- [ ] Registrar migrations adicionadas, classificando cada uma como compartilhada (`db/migrations/`) ou exclusiva de PostgreSQL (`db/postgres-migrations/`); quando não houver, declarar isso.
- [ ] Antes da ativação, identificar o backup protegido armazenado localmente fora da VPS, registrar o SHA-256 conferido de forma independente e documentar o ensaio de restauração em banco isolado.
- [ ] Registrar `CANDIDATE_ATTESTATION_PATH`/`CANDIDATE_ATTESTATION_SHA256` e `BACKUP_ATTESTATION_REMOTE_PATH`/`BACKUP_ATTESTATION_SHA256`/`BACKUP_ATTESTATION_EXPIRES_AT_UTC` do mesmo run, incluindo vínculo candidata, paridade fonte/restauração e limpezas.
- [ ] Registrar proveniência do código e da imagem, a versão ativa, e as evidências do ledger e dos dados agregados antes e depois.
- [ ] Registrar saúde da aplicação e heartbeat do worker, quando aplicável, além da versão anterior preservada.
- [ ] Descrever o retorno permitido pela compatibilidade do schema e marcar claramente se foi apenas preparado ou realmente executado.
- [ ] Remover credenciais, valores brutos de ambiente e dados pessoais de produção. Use identificadores seguros e resultados agregados.

## Gate para proposta de módulo futuro

Antes de selecionar uma nova necessidade funcional, registre:

1. A necessidade real observada e o resultado esperado para o usuário.
2. A fonte datada da evidência confirmada, como informação validada por prestadores ou feedback operacional. Não invente conteúdo, prestadores, inventário ou demanda.
3. O domínio candidato, seu escopo delimitado e as regras de negócio afetadas.
4. Os limites e dependências existentes que foram comparados com [a arquitetura evolutiva](../ARQUITETURA-EVOLUTIVA.md), incluindo por que a mudança cabe no monólito modular atual.
5. Os requisitos, verificações e eventual impacto de dados previstos para a entrega.

Não avance uma proposta sem evidência datada e aderência clara a limites de domínio existentes. Esta checklist não seleciona nem implementa um módulo nesta fase.

## Modelo de nota de release

Copie os títulos abaixo para o arquivo da versão. Substitua cada instrução entre colchetes por evidência desta release; se um item não se aplica, registre o motivo.

```markdown
# Release [versão] — [resumo do domínio]

**Status:** [preparada | publicada em data e fuso | cancelada]

## Escopo e rastreabilidade

- Domínio e escopo: [resultado esperado e limites]
- Requisitos: [IDs e estado]
- Plano GSD: [fase/plano e link]
- Verificações: [comandos ou procedimentos, resultado e limitações]

## Migrations e compatibilidade

- Migrations: [nenhuma | arquivos adicionados e classificação compartilhada/PostgreSQL]
- Ledger antes/depois: [contagem e evidência de comparação/checksum]
- Compatibilidade da versão anterior com o schema após a release: [evidência e conclusão]

## Backup e ensaio de restauração

- Identificador do backup local protegido: [nome ou identificador]
- SHA-256 conferido independentemente: [hash desta cópia]
- Restauração isolada: [banco de destino isolado, resultado e limpeza confirmada]
- Dados agregados restaurados: [contagens relevantes, sem dados pessoais]

## Proveniência e ativação

- Commit-fonte e snapshot: [commit, arquivo e hash verificados]
- Imagem: [tag, digest e evidência de origem]
- Ativação: [versão, troca e serviços afetados]
- Dados agregados antes/depois: [contagens relevantes e resultado]
- Saúde: [HTTP/status/versão/banco] e [heartbeat do worker, se aplicável]
- Saúde HTTPS canônica: [SITE_URL protegido, 200, status=ok, versão candidata, database=postgresql; sem redirect]
- Versão anterior preservada: [tag/imagem e confirmação]

## Retorno

- Estado: [preparado, não executado | executado em data/hora]
- Compatibilidade do schema: [evidência que permite retorno direto]
- Instrução autorizada: [passos condicionais à compatibilidade]
- Se incompatível: [restaurar em banco separado e apontar a versão anterior somente para esse banco]

## Evidências e observações

- [Links ou referências locais a recibos, relatórios e verificações; não incluir segredos]
```

Um retorno preparado não comprova execução. Nunca direcione código antigo a um schema incompatível. Releases comuns não alteram migrations já aplicadas nem modificam ou reimportam a origem oficial `data/hub.sqlite`.
