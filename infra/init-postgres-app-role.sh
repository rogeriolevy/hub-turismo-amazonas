#!/bin/sh
set -e

: "${POSTGRES_DB:?POSTGRES_DB precisa estar configurado}"
: "${POSTGRES_USER:?POSTGRES_USER precisa estar configurado}"
: "${HUB_DB_USER:?HUB_DB_USER precisa estar configurado}"
: "${HUB_DB_PASSWORD:?HUB_DB_PASSWORD precisa estar configurado}"

case "$POSTGRES_DB" in
  postgres|template0|template1)
    echo "POSTGRES_DB deve ser o banco da aplicação, não um banco de sistema." >&2
    exit 1
    ;;
esac

case "$HUB_DB_USER" in
  ''|[0-9]*|*[!a-zA-Z0-9_]*)
    echo "HUB_DB_USER deve ser um identificador PostgreSQL simples." >&2
    exit 1
    ;;
esac

if [ "${#HUB_DB_USER}" -gt 63 ] || [ "$HUB_DB_USER" = "$POSTGRES_USER" ]; then
  echo "HUB_DB_USER deve ter até 63 caracteres e ser diferente de POSTGRES_USER." >&2
  exit 1
fi

psql --username "$POSTGRES_USER" --dbname postgres \
  --set=database="$POSTGRES_DB" \
  --set=app_user="$HUB_DB_USER" <<'SQL'
\set ON_ERROR_STOP on
\getenv app_password HUB_DB_PASSWORD
SELECT format(
  'CREATE ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION',
  :'app_user',
  :'app_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user')
\gexec
ALTER ROLE :"app_user" WITH LOGIN PASSWORD :'app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
ALTER DATABASE :"database" OWNER TO :"app_user";
SQL
