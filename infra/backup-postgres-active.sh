#!/usr/bin/env bash
set -Eeuo pipefail

unset DOCKER_CONTEXT
export DOCKER_HOST="${DOCKER_HOST:-unix:///var/run/docker.sock}"

release_directory="$(readlink -e -- /opt/hub-turismo/current)"
case "$release_directory" in
  /opt/hub-turismo/release-*) ;;
  *)
    echo "O link current não aponta para uma release Hub válida." >&2
    exit 1
    ;;
esac
if [[ "$(stat -c '%U' "$release_directory")" != "hub" ]]; then
  echo "A release ativa não pertence ao usuário hub." >&2
  exit 1
fi
if find "$release_directory" -xdev \( -type f -o -type d \) -perm /022 -print -quit | grep -q .; then
  echo "A release ativa ainda permite escrita para grupo ou outros." >&2
  exit 1
fi

backup_script="$release_directory/infra/backup-postgres.sh"
env_file="$release_directory/infra/vps.env"
if [[ ! -f "$backup_script" || -L "$backup_script" || ! -f "$env_file" || -L "$env_file" ]]; then
  echo "Os arquivos de backup da release ativa estão ausentes ou inválidos." >&2
  exit 1
fi
if [[ "$(stat -c '%U:%G:%a' "$env_file")" != "hub:hub:600" ]]; then
  echo "O vps.env da release ativa precisa pertencer a hub:hub com modo 600." >&2
  exit 1
fi

command -v docker >/dev/null
postgres_container_id="$(docker ps --filter 'label=com.docker.compose.project=hub-turismo' --filter 'label=com.docker.compose.service=postgres' --format '{{.ID}}' | head -n 1)"
if [[ -z "$postgres_container_id" ]]; then
  echo "O container PostgreSQL do projeto hub-turismo não está em execução." >&2
  exit 1
fi
postgres_state="$(docker inspect --format '{{.State.Status}}' "$postgres_container_id")"
postgres_health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}not-configured{{end}}' "$postgres_container_id")"
if [[ "$postgres_state" != "running" || "$postgres_health" != "healthy" ]]; then
  echo "O container PostgreSQL não está saudável: state=$postgres_state health=$postgres_health." >&2
  exit 1
fi

backup_directory="${BACKUP_DIRECTORY:-/var/backups/hub-turismo}"
retention_value="${BACKUP_RETENTION_DAYS:-14}"
if [[ ! "$retention_value" =~ ^[0-9]{1,4}$ ]]; then
  echo "BACKUP_RETENTION_DAYS precisa ser um número entre 1 e 3650." >&2
  exit 1
fi
retention_days=$((10#$retention_value))
if (( retention_days < 1 || retention_days > 3650 )); then
  echo "BACKUP_RETENTION_DAYS precisa ser um número entre 1 e 3650." >&2
  exit 1
fi

umask 077
mkdir -p -- "$backup_directory"
chmod 700 -- "$backup_directory"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)-$$"
backup_file="$backup_directory/hub-$timestamp.dump"
temporary_file="$backup_file.partial"
checksum_file="$backup_file.sha256"
temporary_checksum="$checksum_file.partial"
if [[ -e "$backup_file" || -e "$temporary_file" || -e "$checksum_file" || -e "$temporary_checksum" ]]; then
  echo "O destino do backup já existe: $backup_file" >&2
  exit 1
fi
trap 'rm -f -- "$temporary_file" "$temporary_checksum" "$checksum_file"' EXIT

echo "Gerando backup do container PostgreSQL $postgres_container_id."
docker exec "$postgres_container_id" sh -ec \
  'pg_dump --format=custom --no-owner --no-privileges --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"' \
  > "$temporary_file"
if [[ ! -s "$temporary_file" ]]; then
  echo "O PostgreSQL não produziu um backup válido." >&2
  exit 1
fi
docker exec -i "$postgres_container_id" pg_restore --list < "$temporary_file" > /dev/null

checksum="$(sha256sum < "$temporary_file" | awk '{ print $1 }')"
if [[ ! "$checksum" =~ ^[a-fA-F0-9]{64}$ ]]; then
  echo "Não foi possível calcular o SHA-256 do backup." >&2
  exit 1
fi
printf '%s\n' "$checksum" > "$temporary_checksum"
mv -- "$temporary_checksum" "$checksum_file"
if ! mv -- "$temporary_file" "$backup_file"; then
  echo "Não foi possível publicar o dump PostgreSQL." >&2
  exit 1
fi
trap - EXIT

find "$backup_directory" -maxdepth 1 -type f \( -name 'hub-*.dump' -o -name 'hub-*.dump.sha256' \) \
  -mmin "+$((retention_days * 1440))" -delete
echo "Backup PostgreSQL criado: $backup_file"
echo "Manifesto SHA-256 criado: $checksum_file"
