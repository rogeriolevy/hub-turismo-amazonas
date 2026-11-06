#!/usr/bin/env bash
set -Eeuo pipefail

die() {
  printf 'ERROR=%s\n' "$1" >&2
  exit 1
}

usage() {
  cat <<'USAGE'
Usage:
  stop-rehearsal-worker.sh --project hub-phase4-YYYYMMDD-HHMM \
    --compose-file PATH --env-file PATH (--inspect-only|--confirm-stop)
USAGE
}

project=""
compose_file=""
env_file=""
inspect_only=false
confirm_stop=false

while (($#)); do
  case "$1" in
    --project|--compose-file|--env-file)
      (($# >= 2)) || { usage >&2; die "MISSING_OPTION_VALUE"; }
      option="$1"
      value="$2"
      shift 2
      case "$option" in
        --project) project="$value" ;;
        --compose-file) compose_file="$value" ;;
        --env-file) env_file="$value" ;;
      esac
      ;;
    --inspect-only)
      inspect_only=true
      shift
      ;;
    --confirm-stop)
      confirm_stop=true
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      usage >&2
      die "UNKNOWN_OPTION"
      ;;
  esac
done

# Reject unsafe targets before invoking Docker or modifying anything.
[[ "$project" =~ ^hub-phase4-[0-9]{8}-[0-9]{4}$ ]] || die "INVALID_REHEARSAL_PROJECT"
[[ "$project" != "hub-turismo" ]] || die "PRODUCTION_PROJECT_FORBIDDEN"
[[ "$inspect_only" != "$confirm_stop" ]] || die "CHOOSE_EXACTLY_ONE_MODE"
[[ -n "$compose_file" && -n "$env_file" ]] || die "COMPOSE_AND_ENV_FILES_REQUIRED"
[[ -f "$compose_file" && ! -L "$compose_file" ]] || die "COMPOSE_FILE_INVALID"
[[ -f "$env_file" && ! -L "$env_file" ]] || die "ENV_FILE_INVALID"
compose_file="$(realpath -e -- "$compose_file")" || die "COMPOSE_FILE_UNRESOLVED"
env_file="$(realpath -e -- "$env_file")" || die "ENV_FILE_UNRESOLVED"
[[ "$(id -un)" == "hub" ]] || die "RUN_AS_HUB_OPERATOR"
command -v docker >/dev/null 2>&1 || die "DOCKER_UNAVAILABLE"
command -v realpath >/dev/null 2>&1 || die "REALPATH_UNAVAILABLE"

# Force the local daemon even when hub has a persisted Docker CLI context for another host.
unset DOCKER_HOST DOCKER_CONFIG COMPOSE_FILE COMPOSE_PROJECT_NAME
export DOCKER_CONTEXT=default
docker_endpoint="$(docker context inspect default --format '{{ (index .Endpoints "docker").Host }}' 2>/dev/null)" \
  || die "DOCKER_CONTEXT_UNAVAILABLE"
[[ "$docker_endpoint" == "unix:///var/run/docker.sock" ]] || die "DOCKER_ENDPOINT_NOT_LOCAL"
docker info >/dev/null 2>&1 || die "DOCKER_DAEMON_UNAVAILABLE"

compose_args=(-p "$project" --env-file "$env_file" -f "$compose_file")
if ! service_list="$(docker compose "${compose_args[@]}" config --services 2>/dev/null)"; then
  die "REHEARSAL_COMPOSE_INVALID"
fi
for service in web booking-email-worker postgres; do
  grep -Fxq "$service" <<<"$service_list" || die "REQUIRED_REHEARSAL_SERVICE_MISSING"
done

container_id_for() {
  local selected_project="$1"
  local service="$2"
  local ids id_count id labels
  ids="$(docker ps -aq \
    --filter "label=com.docker.compose.project=$selected_project" \
    --filter "label=com.docker.compose.service=$service")" || die "DOCKER_CONTAINER_LOOKUP_FAILED"
  mapfile -t id_list <<<"$ids"
  id_count=0
  for id in "${id_list[@]}"; do
    [[ -n "$id" ]] && id_count=$((id_count + 1))
  done
  [[ "$id_count" -eq 1 ]] || die "EXPECTED_ONE_COMPOSE_SERVICE_CONTAINER"
  id="${id_list[0]}"
  labels="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}' "$id" 2>/dev/null)" || die "CONTAINER_INSPECTION_FAILED"
  [[ "$labels" == "$selected_project|$service" ]] || die "COMPOSE_LABEL_MISMATCH"
  printf '%s' "$id"
}

service_state() {
  docker inspect --format '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}not-configured{{end}}' "$1" 2>/dev/null \
    || die "CONTAINER_STATE_INSPECTION_FAILED"
}

postgres_volume_for() {
  docker inspect --format '{{range .Mounts}}{{if and (eq .Destination "/var/lib/postgresql") (eq .Type "volume")}}{{.Name}}{{end}}{{end}}' "$1" 2>/dev/null \
    || die "POSTGRES_VOLUME_INSPECTION_FAILED"
}

production_snapshot() {
  local service id state health
  for service in web booking-email-worker postgres; do
    id="$(container_id_for hub-turismo "$service")"
    state="$(service_state "$id")"
    IFS='|' read -r state health <<<"$state"
    [[ "$state" == "running" && "$health" == "healthy" ]] || die "PRODUCTION_SERVICE_NOT_HEALTHY"
    printf '%s=%s|%s|%s\n' "$service" "$id" "$state" "$health"
  done
}

assert_project_networks() {
  local id="$1"
  local network_names network labels network_count=0
  network_names="$(docker inspect --format '{{range $name, $network := .NetworkSettings.Networks}}{{printf "%s\n" $name}}{{end}}' "$id" 2>/dev/null)" \
    || die "NETWORK_INSPECTION_FAILED"
  [[ -n "$network_names" ]] || die "REHEARSAL_NETWORK_MISSING"
  while IFS= read -r network; do
    [[ -n "$network" ]] || continue
    labels="$(docker network inspect --format '{{index .Labels "com.docker.compose.project"}}' "$network" 2>/dev/null)" \
      || die "NETWORK_INSPECTION_FAILED"
    [[ "$labels" == "$project" ]] || die "EXTERNAL_OR_SHARED_NETWORK_FORBIDDEN"
    network_count=$((network_count + 1))
  done <<<"$network_names"
  [[ "$network_count" -gt 0 ]] || die "REHEARSAL_NETWORK_MISSING"
}

assert_no_published_ports() {
  local id="$1"
  local published
  published="$(docker inspect --format '{{range $port, $bindings := .NetworkSettings.Ports}}{{if $bindings}}{{range $bindings}}{{printf "%s:%s\n" .HostIp .HostPort}}{{end}}{{end}}{{end}}' "$id" 2>/dev/null)" \
    || die "PORT_INSPECTION_FAILED"
  [[ -z "$published" ]] || die "PUBLISHED_PORT_FORBIDDEN"
}

target_web_id="$(container_id_for "$project" web)"
target_worker_id="$(container_id_for "$project" booking-email-worker)"
target_postgres_id="$(container_id_for "$project" postgres)"
prod_web_id="$(container_id_for hub-turismo web)"
prod_worker_id="$(container_id_for hub-turismo booking-email-worker)"
prod_postgres_id="$(container_id_for hub-turismo postgres)"
[[ "$target_web_id" != "$prod_web_id" && "$target_worker_id" != "$prod_worker_id" && "$target_postgres_id" != "$prod_postgres_id" ]] \
  || die "PRODUCTION_CONTAINER_TARGET_FORBIDDEN"

production_before="$(production_snapshot)" || die "PRODUCTION_SNAPSHOT_BEFORE_FAILED"
production_postgres_volume="$(postgres_volume_for "$prod_postgres_id")"
rehearsal_postgres_volume="$(postgres_volume_for "$target_postgres_id")"
[[ -n "$production_postgres_volume" && -n "$rehearsal_postgres_volume" ]] || die "POSTGRES_VOLUME_REQUIRED"
[[ "$rehearsal_postgres_volume" != "$production_postgres_volume" ]] || die "PRODUCTION_VOLUME_TARGET_FORBIDDEN"
[[ "$rehearsal_postgres_volume" == "${project}_"* ]] || die "REHEARSAL_VOLUME_NAME_MISMATCH"
volume_project="$(docker volume inspect --format '{{index .Labels "com.docker.compose.project"}}' "$rehearsal_postgres_volume" 2>/dev/null)" \
  || die "REHEARSAL_VOLUME_INSPECTION_FAILED"
volume_key="$(docker volume inspect --format '{{index .Labels "com.docker.compose.volume"}}' "$rehearsal_postgres_volume" 2>/dev/null)" \
  || die "REHEARSAL_VOLUME_INSPECTION_FAILED"
[[ "$volume_project" == "$project" && "$volume_key" == "postgres_data" ]] || die "EXTERNAL_OR_SHARED_VOLUME_FORBIDDEN"

for id in "$target_web_id" "$target_worker_id" "$target_postgres_id"; do
  state="$(service_state "$id")"
  IFS='|' read -r state health <<<"$state"
  [[ "$state" == "running" && "$health" == "healthy" ]] || die "REHEARSAL_SERVICE_NOT_HEALTHY"
  assert_project_networks "$id"
  assert_no_published_ports "$id"
done

worker_environment="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$target_worker_id" 2>/dev/null)" \
  || die "WORKER_ENV_INSPECTION_FAILED"
booking_email_value=""
booking_email_count=0
while IFS= read -r environment_entry; do
  if [[ "$environment_entry" == BOOKING_EMAIL_NOTIFICATIONS=* ]]; then
    booking_email_value="${environment_entry#*=}"
    booking_email_count=$((booking_email_count + 1))
  fi
done <<<"$worker_environment"
[[ "$booking_email_count" -eq 1 && "${booking_email_value,,}" == "false" ]] || die "BOOKING_EMAIL_MUST_BE_DISABLED"
for variable in SMTP_HOST SMTP_USER SMTP_PASSWORD SMTP_FROM; do
  while IFS= read -r environment_entry; do
    if [[ "$environment_entry" == "$variable="* && -n "${environment_entry#*=}" ]]; then
      die "EFFECTIVE_SMTP_CONFIGURATION_FORBIDDEN"
    fi
  done <<<"$worker_environment"
done

worker_before="$(service_state "$target_worker_id")"
printf 'REHEARSAL_PROJECT=%s\n' "$project"
printf 'REHEARSAL_WEB_ID=%s\n' "$target_web_id"
printf 'REHEARSAL_WORKER_ID=%s\n' "$target_worker_id"
printf 'REHEARSAL_POSTGRES_ID=%s\n' "$target_postgres_id"
printf 'REHEARSAL_POSTGRES_VOLUME=%s\n' "$rehearsal_postgres_volume"
printf 'BOOKING_EMAIL=disabled\nSMTP_CONFIGURATION=absent\nPUBLISHED_PORTS=none\n'
printf '%s\n' 'PRODUCTION_SNAPSHOT_BEFORE_BEGIN' "$production_before" 'PRODUCTION_SNAPSHOT_BEFORE_END'

if [[ "$confirm_stop" == "true" ]]; then
  stop_status=0
  docker compose "${compose_args[@]}" stop booking-email-worker >/dev/null || stop_status=$?
  production_after="$(production_snapshot)" || die "PRODUCTION_SNAPSHOT_AFTER_FAILED"
  printf '%s\n' 'PRODUCTION_SNAPSHOT_AFTER_BEGIN' "$production_after" 'PRODUCTION_SNAPSHOT_AFTER_END'
  [[ "$production_after" == "$production_before" ]] || die "PRODUCTION_SNAPSHOT_CHANGED"
  [[ "$stop_status" -eq 0 ]] || die "REHEARSAL_WORKER_STOP_FAILED"
  worker_after="$(service_state "$target_worker_id")"
  [[ "${worker_after%%|*}" == "exited" ]] || die "REHEARSAL_WORKER_NOT_STOPPED"
  printf 'REHEARSAL_WORKER_STATE=exited\nREHEARSAL_WORKER_STOP=ok\nPRODUCTION_UNCHANGED=ok\n'
else
  production_after="$(production_snapshot)" || die "PRODUCTION_SNAPSHOT_AFTER_FAILED"
  printf '%s\n' 'PRODUCTION_SNAPSHOT_AFTER_BEGIN' "$production_after" 'PRODUCTION_SNAPSHOT_AFTER_END'
  [[ "$production_after" == "$production_before" ]] || die "PRODUCTION_SNAPSHOT_CHANGED"
  [[ "${worker_before%%|*}" == "running" ]] || die "REHEARSAL_WORKER_NOT_RUNNING"
  printf 'REHEARSAL_WORKER_STATE=running\nINSPECT_ONLY=ok\nPRODUCTION_UNCHANGED=ok\n'
fi
