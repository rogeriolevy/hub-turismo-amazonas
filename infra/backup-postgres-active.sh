#!/usr/bin/env bash
set -Eeuo pipefail

unset DOCKER_CONTEXT
export DOCKER_HOST="${DOCKER_HOST:-unix:///var/run/docker.sock}"

install_root="/opt/hub-turismo"
if [[ "${HUB_BACKUP_TEST_MODE:-}" == "true" ]]; then
  [[ -n "${HUB_INSTALL_ROOT:-}" && -d "${HUB_INSTALL_ROOT:-}" && ! -L "${HUB_INSTALL_ROOT:-}" ]] || { echo "TEST_INSTALL_ROOT_INVALID" >&2; exit 1; }
  [[ -f "$HUB_INSTALL_ROOT/.hub-backup-fixture" && ! -L "$HUB_INSTALL_ROOT/.hub-backup-fixture" ]] || { echo "TEST_FIXTURE_SENTINEL_MISSING" >&2; exit 1; }
  grep -Fxq "hub-backup-test-fixture-v1" "$HUB_INSTALL_ROOT/.hub-backup-fixture" || { echo "TEST_FIXTURE_SENTINEL_INVALID" >&2; exit 1; }
  install_root="$HUB_INSTALL_ROOT"
elif [[ -n "${HUB_INSTALL_ROOT:-}" || -n "${HUB_BACKUP_TEST_MODE:-}" ]]; then
  echo "TEST_FLAGS_FORBIDDEN_IN_PRODUCTION_MODE" >&2
  exit 1
fi

die() { echo "$1" >&2; exit 1; }
release_directory="$(readlink -e -- "$install_root/current")" || die "ACTIVE_RELEASE_UNRESOLVED"
case "$release_directory" in "$install_root"/release-*) ;; *) die "ACTIVE_RELEASE_INVALID" ;; esac
if [[ "${HUB_BACKUP_TEST_MODE:-}" != "true" && "$(stat -c '%U' "$release_directory")" != "hub" ]]; then die "ACTIVE_RELEASE_OWNER_INVALID"; fi
if find "$release_directory" -xdev \( -type f -o -type d \) -perm /022 -print -quit | grep -q .; then die "ACTIVE_RELEASE_WRITABLE"; fi

backup_script="$release_directory/infra/backup-postgres.sh"
source_helper="$release_directory/scripts/capture-postgres-backup-source.mjs"
env_file="$release_directory/infra/vps.env"
for required_file in "$backup_script" "$source_helper" "$env_file"; do [[ -f "$required_file" && ! -L "$required_file" ]] || die "ACTIVE_RELEASE_FILE_INVALID"; done
if [[ "${HUB_BACKUP_TEST_MODE:-}" != "true" && "$(stat -c '%U:%G:%a' "$env_file")" != "hub:hub:600" ]]; then die "ACTIVE_ENV_MODE_INVALID"; fi

command -v docker >/dev/null || die "DOCKER_UNAVAILABLE"
service_container() {
  local service="$1"; local -a ids=()
  mapfile -t ids < <(docker ps --filter 'label=com.docker.compose.project=hub-turismo' --filter "label=com.docker.compose.service=$service" --format '{{.ID}}')
  [[ "${#ids[@]}" == 1 && -n "${ids[0]}" ]] || die "EXPECTED_ONE_${service^^}_CONTAINER"
  printf '%s' "${ids[0]}"
}
container_healthy() {
  local container="$1"
  [[ "$(docker inspect --format '{{.State.Status}}' "$container")" == "running" ]] || die "CONTAINER_NOT_RUNNING"
  [[ "$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}not-configured{{end}}' "$container")" == "healthy" ]] || die "CONTAINER_NOT_HEALTHY"
}
postgres_container_id="$(service_container postgres)"
web_container_id="$(service_container web)"
container_healthy "$postgres_container_id"
container_healthy "$web_container_id"

backup_directory="${BACKUP_DIRECTORY:-/var/backups/hub-turismo}"
retention_value="${BACKUP_RETENTION_DAYS:-14}"
[[ "$retention_value" =~ ^[0-9]{1,4}$ ]] || die "BACKUP_RETENTION_INVALID"
retention_days=$((10#$retention_value))
(( retention_days >= 1 && retention_days <= 3650 )) || die "BACKUP_RETENTION_INVALID"

umask 077
mkdir -p -- "$backup_directory"
chmod 700 -- "$backup_directory"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)-$$"
backup_file="$backup_directory/hub-$timestamp.dump"
checksum_file="$backup_file.sha256"
source_receipt_file="$backup_directory/hub-$timestamp.source.json"
source_receipt_checksum_file="$source_receipt_file.sha256"
temporary_file="$backup_file.partial"
temporary_checksum="$checksum_file.partial"
source_receipt_temporary="$source_receipt_file.partial"
source_receipt_checksum_temporary="$source_receipt_checksum_file.partial"
for path in "$backup_file" "$checksum_file" "$source_receipt_file" "$source_receipt_checksum_file" "$temporary_file" "$temporary_checksum" "$source_receipt_temporary" "$source_receipt_checksum_temporary"; do [[ ! -e "$path" && ! -L "$path" ]] || die "BACKUP_DESTINATION_EXISTS"; done
published=false
cleanup_owned_partials() {
  local status=$?
  rm -f -- "$temporary_file" "$temporary_checksum" "$source_receipt_temporary" "$source_receipt_checksum_temporary"
  if [[ "$published" != true ]]; then rm -f -- "$backup_file" "$checksum_file" "$source_receipt_file" "$source_receipt_checksum_file"; fi
  exit "$status"
}
trap cleanup_owned_partials EXIT

coproc SOURCE_HELPER { docker exec -i "$web_container_id" node /app/scripts/capture-postgres-backup-source.mjs; }
source_stdout_fd="${SOURCE_HELPER[0]}"
source_stdin_fd="${SOURCE_HELPER[1]}"
read_source_line() { local value; IFS= read -r value <&"$source_stdout_fd" || die "SOURCE_HELPER_PROTOCOL_FAILED"; printf '%s' "$value"; }
snapshot_line="$(read_source_line)"
record_line="$(read_source_line)"
role_line="$(read_source_line)"
[[ "$snapshot_line" =~ ^SNAPSHOT_ID=([A-Fa-f0-9]+-[0-9]+)$ ]] || die "SOURCE_SNAPSHOT_INVALID"
snapshot_id="${BASH_REMATCH[1]}"
[[ "$record_line" == SOURCE_RECORD=* ]] || die "SOURCE_RECORD_INVALID"
source_record="${record_line#SOURCE_RECORD=}"
[[ "$role_line" =~ ^SOURCE_ROLE=([A-Za-z_][A-Za-z0-9_\$-]*)$ ]] || die "SOURCE_ROLE_INVALID"
source_role="${BASH_REMATCH[1]}"
printf '%s' "$source_record" | node -e 'const fs=require("fs"); const text=fs.readFileSync(0,"utf8"); let value; try { value=JSON.parse(text); } catch { process.exit(1) }; const wanted=["schema","capturedAtUtc","counts","ledgerSha256","releaseVersion"]; const countKeys=Object.keys(value.counts||{}); if (JSON.stringify(Object.keys(value))!==JSON.stringify(wanted) || value.schema!=="hub-postgres-source-v1" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.capturedAtUtc) || !/^[a-f0-9]{64}$/.test(value.ledgerSha256) || !/^\d+\.\d+\.\d+$/.test(value.releaseVersion) || countKeys.some((key,index)=>key!==[...countKeys].sort()[index] || !/^(0|[1-9]\d*)$/.test(value.counts[key])) || JSON.stringify(value)!==text) process.exit(1);' || die "SOURCE_RECORD_INVALID"
# PostgreSQL permits importing an exported snapshot as its exporting role.  Capture
# and dump as the dedicated application owner: it has the minimum database
# privileges required for a consistent logical backup, while POSTGRES_USER remains
# a distinct administrative role for bootstrap and recovery operations.
docker exec "$postgres_container_id" sh -ec 'test "$HUB_DB_USER" = "$1"' sh "$source_role" || die "SNAPSHOT_ROLE_MISMATCH"

docker exec "$postgres_container_id" sh -ec 'exec pg_dump --snapshot="$1" --format=custom --no-owner --no-privileges --username "$HUB_DB_USER" --dbname "$POSTGRES_DB"' sh "$snapshot_id" > "$temporary_file" || die "PG_DUMP_FAILED"
[[ -s "$temporary_file" ]] || die "PG_DUMP_EMPTY"
docker exec -i "$postgres_container_id" pg_restore --list < "$temporary_file" > /dev/null || die "PG_DUMP_ARCHIVE_INVALID"
printf 'COMPLETE\n' >&"$source_stdin_fd" || die "SOURCE_COMPLETION_WRITE_FAILED"
exec {source_stdin_fd}>&-
wait "$SOURCE_HELPER_PID" || die "SOURCE_COMPLETION_FAILED"
if IFS= read -r extra_line <&"$source_stdout_fd"; then die "SOURCE_HELPER_EXTRA_OUTPUT"; fi
exec {source_stdout_fd}<&-

dump_checksum="$(sha256sum < "$temporary_file" | awk '{print $1}')"
source_checksum="$(printf '%s' "$source_record" | sha256sum | awk '{print $1}')"
[[ "$dump_checksum" =~ ^[a-fA-F0-9]{64}$ && "$source_checksum" =~ ^[a-fA-F0-9]{64}$ ]] || die "CHECKSUM_INVALID"
printf '%s\n' "$dump_checksum" > "$temporary_checksum"
printf '%s' "$source_record" > "$source_receipt_temporary"
printf '%s\n' "$source_checksum" > "$source_receipt_checksum_temporary"
mv -- "$temporary_file" "$backup_file"
mv -- "$temporary_checksum" "$checksum_file"
mv -- "$source_receipt_temporary" "$source_receipt_file"
mv -- "$source_receipt_checksum_temporary" "$source_receipt_checksum_file"
published=true
trap - EXIT

# Retention removes only complete, owned four-file sets. A partial set blocks deletion.
while IFS= read -r old_dump; do
  old_base="${old_dump%.dump}"; old_source="$old_base.source.json"
  [[ -f "$old_dump.sha256" && ! -L "$old_dump.sha256" && -f "$old_source" && ! -L "$old_source" && -f "$old_source.sha256" && ! -L "$old_source.sha256" ]] || die "RETENTION_PARTIAL_SET"
  rm -f -- "$old_dump" "$old_dump.sha256" "$old_source" "$old_source.sha256"
done < <(find "$backup_directory" -maxdepth 1 -type f -name 'hub-*.dump' -mmin "+$((retention_days * 1440))" -print)

echo "Backup PostgreSQL criado: $backup_file"
echo "Manifesto SHA-256 criado: $checksum_file"
echo "SOURCE_RECEIPT_FILE=$source_receipt_file"
echo "SOURCE_RECEIPT_SHA256=$source_checksum"
