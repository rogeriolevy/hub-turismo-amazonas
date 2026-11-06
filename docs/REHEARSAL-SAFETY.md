# Segurança do ensaio do worker de reservas

Use este roteiro somente na VPS, pela conta `hub`, com uma stack descartável criada para homologação. O nome do projeto precisa seguir `hub-phase4-YYYYMMDD-HHMM`, o PostgreSQL deve usar volume próprio, nenhum serviço pode publicar portas, os dados devem ser sintéticos e as notificações por e-mail/SMTP devem estar desativadas.

## Pré-condições

- Confirme por inspeção somente leitura que `hub-turismo` continua saudável na release esperada.
- Crie o projeto descartável com redes e volume próprios; não conecte serviços à rede de produção nem use o volume `hub-turismo_postgres_data`.
- Defina `BOOKING_EMAIL_NOTIFICATIONS=false` e deixe SMTP_HOST, SMTP_USER, SMTP_PASSWORD e SMTP_FROM vazios no worker. A porta SMTP padrão, sem host/credenciais e com notificações desativadas, não habilita envio.
- Não use cópia de dados oficiais, credenciais produtivas, `data/hub.sqlite` ou dados pessoais.
- Proteja o arquivo de ambiente (`chmod 600`) e nunca o imprima nem o inclua em logs.

## Inspeção e parada

Primeiro rode a inspeção sem alterações:

```bash
infra/stop-rehearsal-worker.sh \
  --project hub-phase4-20261105-0900 \
  --compose-file /var/tmp/hub-phase4-20261105-0900/compose.yaml \
  --env-file /var/tmp/hub-phase4-20261105-0900/rehearsal.env \
  --inspect-only
```

Revise `REHEARSAL_PROJECT`, as três identidades de serviço, `REHEARSAL_POSTGRES_VOLUME`, `BOOKING_EMAIL=disabled`, `SMTP_CONFIGURATION=absent`, `PUBLISHED_PORTS=none` e os snapshots produtivos. Se tudo estiver correto, a parada autorizada é somente:

```bash
infra/stop-rehearsal-worker.sh \
  --project hub-phase4-20261105-0900 \
  --compose-file /var/tmp/hub-phase4-20261105-0900/compose.yaml \
  --env-file /var/tmp/hub-phase4-20261105-0900/rehearsal.env \
  --confirm-stop
```

O sucesso precisa terminar com `REHEARSAL_WORKER_STOP=ok` e `PRODUCTION_UNCHANGED=ok`. O utilitário rejeita projetos de produção ou nomes malformados antes de chamar Docker, e nunca executa `docker stop`, `docker compose down` ou operações sobre PostgreSQL.

## Condições de aborto

Interrompa se o usuário local não for `hub`, Compose não validar, qualquer serviço estiver ausente/não saudável, labels não corresponderem, o worker não declarar notificações desativadas, existir configuração SMTP efetiva, rede/volume não pertencer exatamente ao projeto descartável, houver porta publicada, produção não estiver saudável ou os snapshots antes/depois divergirem. Não tente corrigir um alvo de produção durante o ensaio.

## Limpeza e responsabilidade

O responsável pelo projeto descartável é responsável pela limpeza depois de coletar a evidência. Confirme labels exatas de projeto nos containers, redes e volume antes de remover cada recurso do ensaio; preserve o dump/recibo local de backup e qualquer serviço produtivo. Não use o utilitário de parada para limpar a stack, não execute `down` e não remova recursos que não tenham as labels `hub-phase4-...` daquele ensaio. Ao final, confirme que nenhum recurso desse projeto permanece e que o snapshot de produção continua idêntico.
