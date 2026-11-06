#!/usr/bin/env bash
set -Eeuo pipefail

readonly install_root="/opt/hub-turismo"
readonly backup_directory="/var/backups/hub-turismo"
readonly backup_service="hub-postgres-backup.service"
readonly backup_timer="hub-postgres-backup.timer"
readonly active_backup_wrapper="/opt/hub-turismo/backup-postgres-active.sh"

if (( EUID != 0 )); then
  echo "Execute este roteiro como root." >&2
  exit 1
fi

command -v docker >/dev/null
command -v systemctl >/dev/null
command -v runuser >/dev/null

docker_context="$(docker context show)"
docker_endpoint="$(docker context inspect "$docker_context" --format '{{ (index .Endpoints "docker").Host }}')"
if [[ ! "$docker_endpoint" =~ ^unix:///[A-Za-z0-9._/-]+$ ]]; then
  echo "O contexto Docker ativo não usa um socket Unix local suportado; nenhuma alteração foi feita." >&2
  exit 1
fi
docker_socket="${docker_endpoint#unix://}"
if [[ ! -S "$docker_socket" ]]; then
  echo "O socket Docker do contexto ativo não existe: $docker_socket. Nenhuma alteração foi feita." >&2
  exit 1
fi
unset DOCKER_CONTEXT
docker_at_endpoint() {
  command docker --host "$docker_endpoint" "$@"
}

postgres_container="$(docker_at_endpoint ps --filter 'label=com.docker.compose.project=hub-turismo' --filter 'label=com.docker.compose.service=postgres' --format '{{.Names}}' | head -n 1)"
postgres_container_id="$(docker_at_endpoint ps --filter 'label=com.docker.compose.project=hub-turismo' --filter 'label=com.docker.compose.service=postgres' --format '{{.ID}}' | head -n 1)"
web_container="$(docker_at_endpoint ps --filter 'label=com.docker.compose.project=hub-turismo' --filter 'label=com.docker.compose.service=web' --format '{{.Names}}' | head -n 1)"
worker_container="$(docker_at_endpoint ps --filter 'label=com.docker.compose.project=hub-turismo' --filter 'label=com.docker.compose.service=booking-email-worker' --format '{{.Names}}' | head -n 1)"

if [[ -z "$postgres_container" || -z "$web_container" || -z "$worker_container" ]]; then
  echo "Os três containers esperados do projeto hub-turismo precisam estar em execução." >&2
  exit 1
fi

postgres_health="$(docker_at_endpoint inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}not-configured{{end}}' "$postgres_container")"
web_health="$(docker_at_endpoint inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}not-configured{{end}}' "$web_container")"
worker_state="$(docker_at_endpoint inspect --format '{{.State.Status}}' "$worker_container")"
if [[ "$postgres_health" != "healthy" || "$web_health" != "healthy" || "$worker_state" != "running" ]]; then
  echo "Pré-condição falhou: postgres=$postgres_health web=$web_health worker=$worker_state. Nenhuma alteração foi feita."
  exit 1
fi

app_image="$(docker_at_endpoint inspect --format '{{.Config.Image}}' "$web_container")"
worker_image="$(docker_at_endpoint inspect --format '{{.Config.Image}}' "$worker_container")"
if [[ "$worker_image" != "$app_image" ]]; then
  echo "Web e worker estão usando imagens diferentes; nenhuma alteração foi feita." >&2
  exit 1
fi
if [[ ! "$app_image" =~ ^hub-turismo-amazonas:([0-9]+\.[0-9]+\.[0-9]+)$ ]]; then
  echo "A imagem ativa não tem uma etiqueta de release Hub reconhecida: $app_image" >&2
  exit 1
fi
release_directory="$install_root/release-${BASH_REMATCH[1]}"
if [[ ! -d "$release_directory" ]]; then
  echo "A pasta da release ativa não existe: $release_directory" >&2
  exit 1
fi
release_directory="$(realpath -e -- "$release_directory")"
case "$release_directory" in
  "$install_root"/release-*) ;;
  *)
    echo "A release ativa resolve para fora de $install_root; nenhuma alteração foi feita." >&2
    exit 1
    ;;
esac
readonly compose_file="$release_directory/infra/compose.vps.yaml"
readonly env_file="$release_directory/infra/vps.env"
readonly backup_script="$release_directory/infra/backup-postgres.sh"
readonly restore_script="$release_directory/infra/restore-postgres.sh"
readonly current_link="$install_root/current"

for required_file in "$compose_file" "$env_file" "$backup_script" "$restore_script"; do
  if [[ ! -f "$required_file" || -L "$required_file" ]]; then
    echo "Arquivo necessário ausente, inválido ou link simbólico: $required_file" >&2
    exit 1
  fi
done

if [[ "$(stat -c '%U' "$release_directory")" != "hub" ]]; then
  echo "A release precisa pertencer ao usuário hub; nenhuma alteração foi feita." >&2
  exit 1
fi
if ! getent passwd hub >/dev/null || ! getent group docker >/dev/null; then
  echo "A conta hub e o grupo docker precisam existir; nenhuma alteração foi feita." >&2
  exit 1
fi
if ! id -nG hub | tr ' ' '\n' | grep -Fxq docker; then
  echo "O usuário hub precisa pertencer ao grupo docker; nenhuma alteração foi feita." >&2
  exit 1
fi
hub_postgres_container_id="$(runuser -u hub -- env -u DOCKER_CONTEXT DOCKER_HOST="$docker_endpoint" /usr/bin/docker ps --filter 'label=com.docker.compose.project=hub-turismo' --filter 'label=com.docker.compose.service=postgres' --format '{{.ID}}' | head -n 1)"
if [[ "$hub_postgres_container_id" != "$postgres_container_id" ]]; then
  echo "Root e hub não estão vendo o mesmo container PostgreSQL pelo socket Docker $docker_socket." >&2
  echo "postgres_root=${postgres_container_id:-ausente} postgres_hub=${hub_postgres_container_id:-ausente}; nenhuma alteração foi feita." >&2
  exit 1
fi
unit_stage="$(mktemp -d /tmp/hub-backup-setup.XXXXXX)"
trap 'rm -f -- "$unit_stage/$backup_service" "$unit_stage/$backup_timer" "$unit_stage/backup-postgres-active.sh" "$unit_stage/backup-postgres-active.previous.sh" "$unit_stage/backup-postgres-active.legacy.sh"; rmdir -- "$unit_stage"' EXIT
cat > "$unit_stage/$backup_service" <<'UNIT'
[Unit]
Description=Backup PostgreSQL da Hub Turismo Amazonas
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
User=hub
Group=docker
WorkingDirectory=/opt/hub-turismo
Environment=BACKUP_DIRECTORY=/var/backups/hub-turismo
ExecStart=/usr/bin/bash /opt/hub-turismo/backup-postgres-active.sh
UMask=0077
NoNewPrivileges=true
UNIT
cat > "$unit_stage/backup-postgres-active.sh" <<'SCRIPT'
#!/usr/bin/env bash
set -Eeuo pipefail

unset DOCKER_CONTEXT
export DOCKER_HOST='__HUB_DOCKER_ENDPOINT__'

# The stable wrapper retains the validated Docker endpoint but delegates all backup
# semantics to the release-owned active wrapper, including the snapshot receipt.
release_directory="$(readlink -e -- /opt/hub-turismo/current)"
case "$release_directory" in
  /opt/hub-turismo/release-*) ;;
  *) echo "O link current não aponta para uma release Hub válida." >&2; exit 1 ;;
esac
exec /usr/bin/bash "$release_directory/infra/backup-postgres-active.sh"

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
SCRIPT
sed -i "s|__HUB_DOCKER_ENDPOINT__|$docker_endpoint|" "$unit_stage/backup-postgres-active.sh"
cat > "$unit_stage/backup-postgres-active.previous.sh" <<'SCRIPT'
#!/usr/bin/env bash
set -Eeuo pipefail

unset DOCKER_CONTEXT
export DOCKER_HOST='__HUB_DOCKER_ENDPOINT__'

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

export HUB_ENV_FILE="$env_file"
export BACKUP_DIRECTORY="${BACKUP_DIRECTORY:-/var/backups/hub-turismo}"
exec /usr/bin/bash "$backup_script"
SCRIPT
sed -i "s|__HUB_DOCKER_ENDPOINT__|$docker_endpoint|" "$unit_stage/backup-postgres-active.previous.sh"
cat > "$unit_stage/backup-postgres-active.legacy.sh" <<'SCRIPT'
#!/usr/bin/env bash
set -Eeuo pipefail

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

export HUB_ENV_FILE="$env_file"
export BACKUP_DIRECTORY="${BACKUP_DIRECTORY:-/var/backups/hub-turismo}"
exec /usr/bin/bash "$backup_script"
SCRIPT
cat > "$unit_stage/$backup_timer" <<'UNIT'
[Unit]
Description=Backup diário PostgreSQL da Hub Turismo Amazonas

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true
Unit=hub-postgres-backup.service

[Install]
WantedBy=timers.target
UNIT

for unit in "$backup_service" "$backup_timer"; do
  destination="/etc/systemd/system/$unit"
  if [[ -e "$destination" || -L "$destination" ]] && { [[ -L "$destination" ]] || ! cmp -s -- "$unit_stage/$unit" "$destination"; }; then
    echo "A unidade systemd já existe como link ou com conteúdo diferente: $destination. Nenhuma alteração foi feita." >&2
    exit 1
  fi
done
replace_active_backup_wrapper=0
if [[ -e "$active_backup_wrapper" || -L "$active_backup_wrapper" ]]; then
  if [[ -L "$active_backup_wrapper" ]]; then
    echo "O wrapper de backup já existe como link simbólico: $active_backup_wrapper. Nenhuma alteração foi feita." >&2
    exit 1
  elif cmp -s -- "$unit_stage/backup-postgres-active.sh" "$active_backup_wrapper"; then
    :
  elif cmp -s -- "$unit_stage/backup-postgres-active.previous.sh" "$active_backup_wrapper"; then
    replace_active_backup_wrapper=1
  elif cmp -s -- "$unit_stage/backup-postgres-active.legacy.sh" "$active_backup_wrapper"; then
    replace_active_backup_wrapper=1
  elif grep -Fq 'pg_dump --format=custom' "$active_backup_wrapper" && grep -Fq 'backup-postgres.sh' "$active_backup_wrapper"; then
    # Recognize only the immediately preceding generated wrapper for its one-time migration.
    replace_active_backup_wrapper=1
  else
    echo "O wrapper de backup já existe com conteúdo diferente do gerado por este roteiro: $active_backup_wrapper. Nenhuma alteração foi feita." >&2
    exit 1
  fi
fi

if [[ -L "$current_link" ]]; then
  if [[ "$(realpath -e -- "$current_link")" != "$release_directory" ]]; then
    echo "O link current aponta para outra release; confira o estado antes de alterá-lo." >&2
    exit 1
  fi
elif [[ -e "$current_link" ]]; then
  echo "O caminho current já existe e não é um link simbólico; nenhuma alteração foi feita." >&2
  exit 1
fi

if [[ -e "$backup_directory" || -L "$backup_directory" ]]; then
  if [[ ! -d "$backup_directory" || -L "$backup_directory" ]]; then
    echo "O destino de backup existe e não é um diretório comum: $backup_directory" >&2
    exit 1
  fi
  if [[ "$(stat -c '%U:%G:%a' "$backup_directory")" != "hub:hub:700" ]]; then
    echo "O diretório de backup já existe com proprietário ou permissões diferentes; confira-o manualmente." >&2
    exit 1
  fi
fi

echo "== Endurecendo permissões da release $app_image =="
chmod -R go-w -- "$release_directory"
chown hub:hub -- "$env_file"
chmod 600 -- "$env_file"

if ! runuser -u hub -- test -r "$env_file"; then
  echo "Mesmo após proteger o vps.env como hub:hub/600, o usuário hub não consegue lê-lo." >&2
  stat -c '%U:%G:%a %n' "$env_file" >&2
  echo "O ambiente foi protegido, mas nenhum backup, link ou timer foi criado." >&2
  exit 1
fi
if ! runuser -u hub -- test -r "$backup_script"; then
  echo "Após remover escrita de grupo e outros, o usuário hub ainda não consegue ler o roteiro de backup." >&2
  stat -c '%U:%G:%a %n' "$backup_script" >&2
  echo "As permissões da release foram endurecidas, mas nenhum backup, link ou timer foi criado." >&2
  exit 1
fi

if [[ ! -L "$current_link" ]]; then
  ln -s -- "$release_directory" "$current_link"
fi

if [[ ! -d "$backup_directory" ]]; then
  install -d -o hub -g hub -m 700 -- "$backup_directory"
fi
if [[ ! -e "$active_backup_wrapper" && ! -L "$active_backup_wrapper" ]]; then
  install -o root -g root -m 755 -- "$unit_stage/backup-postgres-active.sh" "$active_backup_wrapper"
elif (( replace_active_backup_wrapper == 1 )); then
  install -o root -g root -m 755 -- "$unit_stage/backup-postgres-active.sh" "$active_backup_wrapper"
fi

echo "== Criando e validando backup PostgreSQL =="
cd -- "$install_root"
runuser -u hub -- env -u DOCKER_CONTEXT \
  DOCKER_HOST="$docker_endpoint" \
  BACKUP_DIRECTORY="$backup_directory" \
  /usr/bin/bash "$active_backup_wrapper"

backup_file="$(find "$backup_directory" -maxdepth 1 -type f -name 'hub-*.dump' -printf '%T@\t%p\n' | sort -nr | head -n 1 | cut -f 2-)"
if [[ -z "$backup_file" || ! -s "$backup_file" || ! -f "$backup_file.sha256" ]]; then
  echo "O primeiro backup ou seu manifesto não foi encontrado." >&2
  exit 1
fi
expected_checksum="$(tr -d '\r\n' < "$backup_file.sha256")"
actual_checksum="$(sha256sum < "$backup_file" | awk '{ print $1 }')"
if [[ ! "$expected_checksum" =~ ^[a-fA-F0-9]{64}$ || "$actual_checksum" != "$expected_checksum" ]]; then
  echo "A conferência independente do SHA-256 do backup falhou." >&2
  exit 1
fi
runuser -u hub -- env -u DOCKER_CONTEXT \
  DOCKER_HOST="$docker_endpoint" \
  /usr/bin/docker exec -i "$postgres_container_id" pg_restore --list \
  < "$backup_file" > /dev/null

restore_database="hub_restore_$(date -u +%Y%m%d%H%M%S)_$$"
echo "== Ensaio de restauração isolada: $restore_database =="
docker_at_endpoint exec "$postgres_container_id" sh -ec \
  'exec createdb --username "$POSTGRES_USER" --maintenance-db "$POSTGRES_DB" --owner "$HUB_DB_USER" "$1"' \
  sh "$restore_database"
if ! docker_at_endpoint exec -i "$postgres_container_id" sh -ec \
  'exec pg_restore --exit-on-error --no-owner --no-privileges --username "$HUB_DB_USER" --dbname "$1"' \
  sh "$restore_database" < "$backup_file"; then
  if docker_at_endpoint exec "$postgres_container_id" sh -ec \
    'exec dropdb --username "$POSTGRES_USER" --maintenance-db "$POSTGRES_DB" "$1"' \
    sh "$restore_database"; then
    echo "A restauração falhou; o banco parcial recém-criado foi removido." >&2
  else
    echo "A restauração falhou; remova manualmente o banco parcial $restore_database." >&2
  fi
  exit 1
fi

restore_sql="$(cat <<'SQL'
SELECT 'users=' || count(*) FROM "user";
SELECT 'bookings=' || count(*) FROM bookings;
SELECT 'booking_reminders=' || count(*) FROM booking_reminders;
SELECT 'cadastur_entries=' || count(*) FROM cadastur_entries;
SQL
)"
restore_counts="$(docker_at_endpoint exec "$postgres_container_id" sh -ec \
  'psql --username "$HUB_DB_USER" --dbname "$1" -Atc "$2"' \
  sh "$restore_database" "$restore_sql")"

echo "== Instalando timer diário de backup =="
for unit in "$backup_service" "$backup_timer"; do
  destination="/etc/systemd/system/$unit"
  if [[ ! -e "$destination" && ! -L "$destination" ]]; then
    install -o root -g root -m 644 -- "$unit_stage/$unit" "$destination"
  fi
done
systemctl daemon-reload
systemctl enable --now "$backup_timer" >/dev/null
if ! systemctl is-active --quiet "$backup_timer"; then
  echo "O timer de backup não ficou ativo." >&2
  exit 1
fi

echo "BACKUP_FILE=$backup_file"
echo "BACKUP_SHA256=$actual_checksum"
echo "RESTORE_DATABASE=$restore_database"
printf 'RESTORE_COUNTS=%s\n' "$restore_counts" | tr '\n' ';' | sed 's/;$//'
echo "BACKUP_TIMER=$(systemctl is-active "$backup_timer")"
echo "BACKUP_OFFSITE_COPY=pendente; mantenha uma cópia fora desta VPS."
