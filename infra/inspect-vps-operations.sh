#!/usr/bin/env bash
set -u

echo "== CONTAINERS DO PROJETO HUB =="
if ! command -v docker >/dev/null 2>&1; then
  echo "DOCKER_UNAVAILABLE"
  exit 0
fi

container_ids="$(docker ps -aq --filter label=com.docker.compose.project=hub-turismo 2>/dev/null)"
if [[ -z "$container_ids" ]]; then
  echo "Nenhum container com o projeto Compose hub-turismo."
else
  while IFS= read -r container_id; do
    [[ -n "$container_id" ]] || continue
    docker inspect --format '{{.Name}} service={{index .Config.Labels "com.docker.compose.service"}} state={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}not-configured{{end}} image={{.Config.Image}} mounts={{range .Mounts}}{{if .Name}}{{.Name}}{{else}}{{.Source}}{{end}}->{{.Destination}};{{end}}' "$container_id" 2>/dev/null || echo "CONTAINER_INSPECTION_FAILED"
  done <<< "$container_ids"
fi

echo "== PERMISSÕES DAS RELEASES =="
release_root=/opt/hub-turismo
if [[ ! -d "$release_root" ]]; then
  echo "RELEASE_DIRECTORY_ABSENT"
else
  if [[ -L "$release_root/current" ]]; then
    echo "CURRENT_RELEASE=$(readlink -f -- "$release_root/current" 2>/dev/null || echo UNRESOLVED)"
  elif [[ -e "$release_root/current" ]]; then
    echo "CURRENT_RELEASE=PATH_IS_NOT_SYMLINK"
  else
    echo "CURRENT_RELEASE=NOT_CONFIGURED"
  fi

  for release in "$release_root"/release-*; do
    [[ -d "$release" ]] || continue
    release_owner="$(stat -c '%U:%G' "$release" 2>/dev/null || echo UNKNOWN)"
    release_mode="$(stat -c '%a' "$release" 2>/dev/null || echo UNKNOWN)"
    writable_entries="$(find "$release" -xdev \( -type f -o -type d \) -perm /022 -printf '.' 2>/dev/null | wc -c | tr -d '[:space:]')"
    env_file="$release/infra/vps.env"
    if [[ -f "$env_file" ]]; then
      env_permissions="$(stat -c '%U:%G:%a' "$env_file" 2>/dev/null || echo UNKNOWN)"
    else
      env_permissions=ABSENT
    fi
    echo "release=$(basename "$release") owner=$release_owner mode=$release_mode group_or_world_writable_entries=${writable_entries:-UNKNOWN} vps.env=$env_permissions"
  done
fi

echo "== HEARTBEAT DO WORKER =="
postgres_id="$(docker ps -q --filter label=com.docker.compose.project=hub-turismo --filter label=com.docker.compose.service=postgres 2>/dev/null | head -n 1)"
if [[ -z "$postgres_id" ]]; then
  echo "PostgreSQL do projeto hub-turismo não está em execução."
else
  if heartbeat="$(docker exec "$postgres_id" sh -ec "psql --username \"\$POSTGRES_USER\" --dbname \"\$POSTGRES_DB\" -Atc \"SELECT state || '|' || GREATEST(0, EXTRACT(EPOCH FROM (now() - last_seen_at::timestamptz))::integer)::text FROM booking_email_worker_heartbeat WHERE worker_id = 'booking-email-worker'\"" 2>/dev/null)"; then
    if [[ -n "$heartbeat" ]]; then
      IFS='|' read -r state age_seconds <<< "$heartbeat"
      echo "state=$state age_seconds=$age_seconds"
    else
      echo "HEARTBEAT_ABSENT"
    fi
  else
    echo "HEARTBEAT_QUERY_FAILED"
  fi
fi

echo "== TIMER E ÚLTIMA EXECUÇÃO DO BACKUP =="
systemctl show hub-postgres-backup.timer --no-pager -p LoadState -p ActiveState -p UnitFileState -p LastTriggerUSec -p NextElapseUSecRealtime 2>/dev/null || echo "BACKUP_TIMER_STATUS_UNAVAILABLE"
systemctl show hub-postgres-backup.service --no-pager -p LoadState -p ActiveState -p SubState -p Result -p ExecMainStatus -p ExecMainStartTimestamp 2>/dev/null || echo "BACKUP_SERVICE_STATUS_UNAVAILABLE"
systemctl list-timers --all --no-pager hub-postgres-backup.timer 2>/dev/null || true

echo "== ARQUIVOS E CHECKSUMS DE BACKUP =="
backup_directory=/var/backups/hub-turismo
if [[ ! -d "$backup_directory" ]]; then
  echo "BACKUP_DIRECTORY_ABSENT"
else
  find "$backup_directory" -maxdepth 1 -type f \( -name 'hub-*.dump' -o -name 'hub-*.dump.sha256' \) -printf '%f %s bytes\n' | sort
  for dump in "$backup_directory"/hub-*.dump; do
    [[ -f "$dump" ]] || continue
    [[ -f "$dump.sha256" ]] || echo "$(basename "$dump"): MANIFEST_MISSING"
  done
  for manifest in "$backup_directory"/hub-*.dump.sha256; do
    [[ -f "$manifest" ]] || continue
    dump="${manifest%.sha256}"
    [[ -f "$dump" ]] || echo "$(basename "$manifest"): DUMP_MISSING"
  done

  latest_dump="$(find "$backup_directory" -maxdepth 1 -type f -name 'hub-*.dump' -printf '%T@ %p\n' | sort -nr | head -n 1 | cut -d ' ' -f 2-)"
  if [[ -n "$latest_dump" ]]; then
    manifest="$latest_dump.sha256"
    if [[ ! -f "$manifest" ]]; then
      echo "LATEST_DUMP_MANIFEST=MISSING"
    else
      expected="$(tr -d '[:space:]' < "$manifest")"
      if [[ ! "$expected" =~ ^[[:xdigit:]]{64}$ ]]; then
        echo "LATEST_DUMP_MANIFEST=INVALID"
      elif [[ "$(sha256sum < "$latest_dump" | awk '{print $1}')" == "$expected" ]]; then
        echo "LATEST_DUMP_SHA256=OK"
      else
        echo "LATEST_DUMP_SHA256=MISMATCH"
      fi
    fi

    if [[ -n "$postgres_id" ]]; then
      if docker exec -i "$postgres_id" pg_restore --list < "$latest_dump" > /dev/null 2>&1; then
        echo "LATEST_DUMP_TOC=OK"
      else
        echo "LATEST_DUMP_TOC=INVALID"
      fi
    fi
  else
    echo "NO_BACKUP_DUMPS"
  fi
fi

echo "== ESPAÇO EM DISCO =="
df -h /opt/hub-turismo /var/backups/hub-turismo 2>/dev/null || true
