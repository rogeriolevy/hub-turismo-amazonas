#!/usr/bin/env bash
set -Eeuo pipefail

script_path="$(realpath -e -- "${BASH_SOURCE[0]}")"
repo_root="$(cd -- "$(dirname -- "$script_path")/.." && pwd -P)"
env_file="${HUB_ENV_FILE:-$repo_root/infra/vps.env}"
backup_file="${1:-}"
target_database="${2:-}"
database_created=0

if [[ $# -ne 2 ]]; then
  echo "Uso: $0 <backup.dump> <novo_banco_destino>" >&2
  exit 2
fi

if [[ ! -f "$env_file" ]]; then
  echo "Arquivo de configuração ausente: $env_file" >&2
  exit 1
fi

if [[ ! -f "$backup_file" || ! -r "$backup_file" ]]; then
  echo "Arquivo de backup ausente ou sem permissão de leitura: $backup_file" >&2
  exit 1
fi

checksum_file="$backup_file.sha256"
if [[ -e "$checksum_file" ]]; then
  if [[ ! -f "$checksum_file" || ! -r "$checksum_file" ]]; then
    echo "Manifesto SHA-256 ausente ou sem permissão de leitura: $checksum_file" >&2
    exit 1
  fi
  expected_checksum="$(< "$checksum_file")"
  if [[ ! "$expected_checksum" =~ ^[a-fA-F0-9]{64}$ ]]; then
    echo "O manifesto SHA-256 do backup é inválido." >&2
    exit 1
  fi
  actual_checksum="$(sha256sum < "$backup_file" | awk '{ print $1 }')"
  if [[ "$actual_checksum" != "$expected_checksum" ]]; then
    echo "O SHA-256 do backup não corresponde ao manifesto; restauração cancelada." >&2
    exit 1
  fi
  echo "SHA-256 do backup confirmado."
else
  echo "Aviso: backup legado sem manifesto SHA-256; será conferido apenas o formato PostgreSQL." >&2
fi

if [[ ! "$target_database" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]]; then
  echo "O banco de destino precisa ser um identificador PostgreSQL simples (até 63 caracteres)." >&2
  exit 1
fi

if [[ ${POSTGRES_DB+x} ]]; then
  configured_database="$POSTGRES_DB"
else
  if ! configured_database="$(awk -F= '
    /^[[:space:]]*#/ { next }
    $1 ~ /^[[:space:]]*POSTGRES_DB[[:space:]]*$/ {
      if (found || NF != 2) exit 2
      value = $2
      sub(/[[:space:]]+#.*$/, "", value)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
      found = 1
    }
    END {
      if (found != 1 || value !~ /^[A-Za-z_][A-Za-z0-9_]*$/ || length(value) > 63) exit 2
      print value
    }
  ' "$env_file")"; then
    echo "POSTGRES_DB ausente ou inválido no ambiente da VPS; restauração cancelada." >&2
    exit 1
  fi
fi
if [[ ! "$configured_database" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]]; then
  echo "POSTGRES_DB precisa ser um identificador PostgreSQL simples; restauração cancelada." >&2
  exit 1
fi
if [[ "$target_database" == "$configured_database" ]]; then
  echo "O banco de destino não pode ser o banco configurado para a aplicação." >&2
  exit 1
fi

postgres_container_id="$(docker ps --filter 'label=com.docker.compose.project=hub-turismo' --filter 'label=com.docker.compose.service=postgres' --format '{{.ID}}' | head -n 1)"
if [[ -z "$postgres_container_id" ]]; then
  echo "O container PostgreSQL do projeto hub-turismo não está em execução; restauração cancelada." >&2
  exit 1
fi
postgres_state="$(docker inspect --format '{{.State.Status}}' "$postgres_container_id")"
postgres_health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}not-configured{{end}}' "$postgres_container_id")"
if [[ "$postgres_state" != "running" || "$postgres_health" != "healthy" ]]; then
  echo "O container PostgreSQL não está saudável: state=$postgres_state health=$postgres_health; restauração cancelada." >&2
  exit 1
fi
docker_exec() {
  docker exec "$postgres_container_id" "$@"
}
docker_exec_stdin() {
  docker exec -i "$postgres_container_id" "$@"
}

cleanup() {
  local status=$?
  if (( status != 0 && database_created == 1 )); then
    if docker_exec sh -ec \
      'exec dropdb --username "$POSTGRES_USER" --maintenance-db "$POSTGRES_DB" "$1"' sh "$target_database"; then
      echo "A restauração falhou; o banco parcial recém-criado foi removido." >&2
    else
      echo "A restauração falhou; remova manualmente o banco parcial $target_database." >&2
    fi
  fi
  return "$status"
}
trap cleanup EXIT

# Validate the custom-format archive before creating anything in PostgreSQL.
docker_exec_stdin pg_restore --list < "$backup_file" > /dev/null

# createdb fails if the name already exists; existing databases are never overwritten.
docker_exec sh -ec \
  'exec createdb --username "$POSTGRES_USER" --maintenance-db "$POSTGRES_DB" --owner "$HUB_DB_USER" "$1"' \
  sh "$target_database"
database_created=1

docker_exec_stdin sh -ec \
  'exec pg_restore --exit-on-error --no-owner --no-privileges --username "$HUB_DB_USER" --dbname "$1"' \
  sh "$target_database" < "$backup_file"

database_created=0
trap - EXIT
echo "Restauração concluída no novo banco: $target_database"
