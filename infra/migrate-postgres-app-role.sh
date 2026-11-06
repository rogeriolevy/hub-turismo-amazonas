#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
compose_file="$repo_root/infra/compose.vps.yaml"
env_file="${HUB_ENV_FILE:-$repo_root/infra/vps.env}"

if [[ ! -f "$env_file" ]]; then
  echo "Arquivo de configuração ausente: $env_file" >&2
  exit 1
fi

docker compose -p hub-turismo --env-file "$env_file" -f "$compose_file" exec -T postgres sh -euc '
  : "${POSTGRES_DB:?POSTGRES_DB precisa estar configurado}"
  : "${POSTGRES_USER:?POSTGRES_USER precisa estar configurado}"
  : "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD precisa estar configurado}"
  : "${HUB_DB_USER:?HUB_DB_USER precisa estar configurado}"
  : "${HUB_DB_PASSWORD:?HUB_DB_PASSWORD precisa estar configurado}"

  case "$POSTGRES_DB" in
    postgres|template0|template1)
      echo "POSTGRES_DB deve ser o banco da aplicação, não um banco de sistema." >&2
      exit 1
      ;;
  esac

  case "$HUB_DB_USER" in
    ""|[0-9]*|*[!a-zA-Z0-9_]*)
      echo "HUB_DB_USER deve ser um identificador PostgreSQL simples." >&2
      exit 1
      ;;
  esac

  if [ "${#HUB_DB_USER}" -gt 63 ] || [ "$HUB_DB_USER" = "$POSTGRES_USER" ]; then
    echo "HUB_DB_USER deve ter até 63 caracteres e ser diferente de POSTGRES_USER." >&2
    exit 1
  fi

  PGPASSWORD="$POSTGRES_PASSWORD" psql --username "$POSTGRES_USER" --dbname postgres \
    --set=ON_ERROR_STOP=on \
    --set=database="$POSTGRES_DB" \
    --set=admin_user="$POSTGRES_USER" \
    --set=app_user="$HUB_DB_USER" \
    --file /tmp/hub-migrate-app-role-bootstrap.sql

  PGPASSWORD="$POSTGRES_PASSWORD" psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    --set=ON_ERROR_STOP=on \
    --set=admin_user="$POSTGRES_USER" \
    --set=app_user="$HUB_DB_USER" \
    --file /tmp/hub-migrate-app-role-objects.sql
'

echo "A conta de aplicação agora é proprietária do banco e dos objetos do schema public configurado."
