# Onboarding empresarial e gestão editorial

**Status:** proposta para validação com empresas; nenhuma mudança de aplicação ou banco foi aprovada por este documento.

## Estado atual confirmado

- `POST /api/conta/cadastro` cria uma conta básica. O cadastro público não cria empresa, vínculo ou papel de equipe; o endpoint também recusa atribuição de administrador.
- A administração cria empresas como rascunho, publicadas ou suspensas. A criação e a alteração exigem sessão administrativa.
- A administração concede acesso somente a uma conta que já existe. O papel precisa corresponder ao tipo da empresa; a conta de guia exige vínculo explícito com o perfil público correto.
- O diretório editorial já permite rascunho e publicação. A revisão de conteúdo complementar ao Cadastur permanece separada do cadastro oficial.
- A conta e o catálogo não têm atualmente uma fila de solicitações de onboarding empresarial.

## Direção proposta

Manter o processo assistido pela administração até que hotéis, operadores e a equipe da Hub definam quem pode solicitar cadastro, como comprovar vínculo com a empresa e quem revisa e publica cada informação. Não abrir um endpoint público que crie empresas, conceda acessos ou publique conteúdo automaticamente.

Depois dessa definição, avaliar uma fila de solicitações com acesso administrativo. Aprovar uma solicitação poderia criar uma empresa inicialmente em rascunho e vincular uma conta verificada; a publicação continuaria como decisão separada. A etapa editorial também deve continuar separada da validação de identidade e do registro oficial Cadastur.

Esta é uma proposta de sequência, não uma decisão de negócio nem autorização para coletar novos dados pessoais.

## Decisões a validar

1. Quem pode solicitar: proprietário, representante, conta existente, e-mail confirmado ou encaminhamento pela equipe da Hub.
2. Quais dados mínimos identificam a empresa e a pessoa autorizada. CNPJ, número Cadastur, documentos e comprovantes só entram após aprovação de finalidade, acesso e retenção.
3. Como a equipe verifica representação, duplicidade e divergência com fontes oficiais; quem pode pedir correções e quem decide aprovação ou recusa.
4. Quais estados e prazos de atendimento são necessários, quais motivos de recusa podem ser exibidos e quanto tempo solicitações recusadas devem ser mantidas.
5. Quem escreve, revisa e publica conteúdo editorial, quais fontes devem acompanhá-lo e como corrigir ou retirar um item publicado.
6. Qual vínculo inicial e qual papel cada tipo de empresa recebe. A atribuição de guia permanece explícita e não deve ser inferida por nome ou e-mail.
7. Como a pessoa pode solicitar correção ou remoção de dados e quais contatos da Hub receberão essas solicitações.

## Limites de segurança para uma futura implementação

- Uma solicitação pública nunca concede papel empresarial, cria uma empresa publicada nem altera conteúdo Cadastur oficial.
- A revisão fica restrita à administração; leituras e transições devem gerar auditoria adequada e validar o estado anterior.
- A conversão aprovada deve ser transacional e idempotente; a conta precisa ser verificada antes de receber vínculo. A publicação continua independente.
- Não receber anexos no primeiro fluxo sem uma decisão sobre armazenamento, acesso, retenção, backup e descarte.
- Uma migration nova deve ser aditiva e testada em SQLite e PostgreSQL. Toda tabela nova precisa de regra explícita de transferência ou exclusão no importador SQLite→PostgreSQL e no backup/restauração.
- As listas administrativas devem ser paginadas e não devem expor dados de solicitantes em APIs públicas.

## Evidências da linha de base

As regras atuais estão em `app/api/conta/cadastro/route.ts`, `server/company-write-service.ts`, `server/company-membership-service.ts`, `components/platform/administration/company-management.tsx` e `components/platform/administration/access-management.tsx`. A matriz de papéis e os limites do catálogo estão em `docs/PLATAFORMA.md`.

## Próximo passo de produto

Validar as decisões acima com representantes de hotéis, operadores e administração da Hub. Depois, aprovar escopo, responsável e critérios de aceite antes de abrir uma migration ou implementar formulário público.
