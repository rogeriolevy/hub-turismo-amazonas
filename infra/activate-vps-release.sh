#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

RELEASE_ROOT="/opt/hub-turismo"
PROJECT="hub-turismo"
APP_SERVICE="web"
WORKER_SERVICE="booking-email-worker"
EXPECTED_TEST_SENTINEL="hub-activation-test-fixture-v1"
EXPECTED_FAKE_SENTINEL="hub-activation-fake-runtime-v1"

die() {
  printf 'ERROR=%s\n' "$1" >&2
  exit 1
}

canonical_existing_path() {
  local resolved
  resolved="$(realpath -e -- "$1")" || return 1
  if [[ "${test_only:-false}" == "true" && ( "$OSTYPE" == msys* || "$OSTYPE" == cygwin* ) ]]; then
    resolved="$(cygpath -asw "$resolved")" || return 1
  fi
  printf '%s' "$resolved"
}

usage() {
  cat <<'USAGE'
Production:
  activate-vps-release.sh --candidate PATH --previous PATH \
    --candidate-attestation PATH --candidate-attestation-sha256 HASH \
    --backup-attestation PATH --backup-attestation-sha256 HASH (--dry-run|--activate)

Disposable test fixture only:
  activate-vps-release.sh --test-only --fixture-root PATH --fake-bin PATH [--simulate-activate]
USAGE
}

candidate_arg=""
previous_arg=""
candidate_attestation_arg=""
candidate_attestation_sha256_arg=""
backup_attestation_arg=""
backup_attestation_sha256_arg=""
fixture_root_arg=""
fake_bin_arg=""
mode=""
test_only=false
simulate_activate=false

while (($#)); do
  case "$1" in
    --candidate|--previous|--candidate-attestation|--candidate-attestation-sha256|--backup-attestation|--backup-attestation-sha256|--fixture-root|--fake-bin)
      (($# >= 2)) || { usage >&2; die "MISSING_OPTION_VALUE"; }
      option="$1"
      value="$2"
      shift 2
      case "$option" in
        --candidate) candidate_arg="$value" ;;
        --previous) previous_arg="$value" ;;
        --candidate-attestation) candidate_attestation_arg="$value" ;;
        --candidate-attestation-sha256) candidate_attestation_sha256_arg="$value" ;;
        --backup-attestation) backup_attestation_arg="$value" ;;
        --backup-attestation-sha256) backup_attestation_sha256_arg="$value" ;;
        --fixture-root) fixture_root_arg="$value" ;;
        --fake-bin) fake_bin_arg="$value" ;;
      esac
      ;;
    --dry-run|--activate)
      [[ -z "$mode" ]] || die "CHOOSE_EXACTLY_ONE_MODE"
      mode="$1"
      shift
      ;;
    --test-only)
      test_only=true
      shift
      ;;
    --simulate-activate)
      simulate_activate=true
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

if [[ "$test_only" == "true" ]]; then
  [[ -z "$candidate_arg" && -z "$previous_arg" && -z "$mode" ]] || die "PRODUCTION_FLAGS_FORBIDDEN_IN_TEST_MODE"
  [[ -n "$fixture_root_arg" && -n "$fake_bin_arg" ]] || die "TEST_FIXTURE_ARGUMENTS_REQUIRED"
  case "$fixture_root_arg/" in /opt/hub-turismo/*|/opt/hub-turismo/) die "PRODUCTION_PATH_FORBIDDEN_IN_TEST_MODE" ;; *) ;; esac
  fixture_root="$(realpath -e -- "$fixture_root_arg")" || die "TEST_FIXTURE_ROOT_UNRESOLVED"
  temp_root="$(realpath -e -- "${TMPDIR:-/tmp}")" || die "TEMP_ROOT_UNRESOLVED"
  case "$fixture_root/" in "$temp_root"/*) ;; *) die "TEST_FIXTURE_MUST_BE_IN_TEMP_ROOT" ;; esac
  case "$fixture_root/" in /opt/hub-turismo/*) die "PRODUCTION_PATH_FORBIDDEN_IN_TEST_MODE" ;; *) ;; esac
  [[ -f "$fixture_root/.hub-activation-fixture" && ! -L "$fixture_root/.hub-activation-fixture" ]] || die "TEST_FIXTURE_SENTINEL_MISSING"
  grep -Fxq "$EXPECTED_TEST_SENTINEL" "$fixture_root/.hub-activation-fixture" || die "TEST_FIXTURE_SENTINEL_INVALID"
  fake_bin="$(realpath -e -- "$fake_bin_arg")" || die "FAKE_BIN_UNRESOLVED"
  case "$fake_bin/" in "$fixture_root"/*) ;; *) die "FAKE_BIN_MUST_BE_INSIDE_FIXTURE" ;; esac
  [[ -f "$fake_bin/.hub-fake-runtime" && ! -L "$fake_bin/.hub-fake-runtime" ]] || die "FAKE_RUNTIME_SENTINEL_MISSING"
  grep -Fxq "$EXPECTED_FAKE_SENTINEL" "$fake_bin/.hub-fake-runtime" || die "FAKE_RUNTIME_SENTINEL_INVALID"
  for fake_command in docker curl; do
    fake_path="$fake_bin/$fake_command"
    [[ -f "$fake_path" && -x "$fake_path" && ! -L "$fake_path" ]] || die "FAKE_COMMAND_INVALID"
    grep -Fq "$EXPECTED_FAKE_SENTINEL" "$fake_path" || die "FAKE_COMMAND_SENTINEL_INVALID"
  done
  candidate="$fixture_root/release-candidate"
  previous="$fixture_root/release-previous"
  current="$fixture_root/current"
  DOCKER_BIN="$fake_bin/docker"
  CURL_BIN="$fake_bin/curl"
  [[ -d "$candidate" && ! -L "$candidate" && -d "$previous" && ! -L "$previous" && -L "$current" ]] || die "TEST_RELEASE_FIXTURE_INVALID"
  candidate="$(canonical_existing_path "$candidate")" || die "TEST_CANDIDATE_UNRESOLVED"
  previous="$(canonical_existing_path "$previous")" || die "TEST_PREVIOUS_UNRESOLVED"
  [[ "$(canonical_existing_path "$current")" == "$previous" ]] || die "CURRENT_DOES_NOT_MATCH_PREVIOUS"
else
  [[ -z "$fixture_root_arg" && -z "$fake_bin_arg" && "$simulate_activate" == "false" ]] || die "TEST_FLAGS_FORBIDDEN_IN_PRODUCTION_MODE"
  [[ -n "$candidate_arg" && -n "$previous_arg" ]] || { usage >&2; die "RELEASE_PATHS_REQUIRED"; }
  [[ "$mode" == "--dry-run" || "$mode" == "--activate" ]] || die "CHOOSE_EXACTLY_ONE_MODE"
  [[ "$(id -un)" == "hub" ]] || die "RUN_AS_HUB_OPERATOR"
  candidate="$(realpath -e -- "$candidate_arg")" || die "CANDIDATE_UNRESOLVED"
  previous="$(realpath -e -- "$previous_arg")" || die "PREVIOUS_UNRESOLVED"
  current="$RELEASE_ROOT/current"
  [[ -d "$candidate_arg" && ! -L "$candidate_arg" && -d "$previous_arg" && ! -L "$previous_arg" ]] || die "RELEASE_DIRECTORY_INVALID"
  [[ "$candidate" =~ ^/opt/hub-turismo/release-[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || die "CANDIDATE_OUTSIDE_RELEASE_ROOT"
  [[ "$previous" =~ ^/opt/hub-turismo/release-[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || die "PREVIOUS_OUTSIDE_RELEASE_ROOT"
  [[ "$candidate" != "$previous" ]] || die "CANDIDATE_EQUALS_PREVIOUS"
  [[ -L "$current" && "$(realpath -e -- "$current")" == "$previous" ]] || die "CURRENT_DOES_NOT_MATCH_PREVIOUS"
  unset DOCKER_HOST DOCKER_CONTEXT COMPOSE_FILE COMPOSE_PROJECT_NAME
  DOCKER_BIN="docker"
  CURL_BIN="curl"
fi

docker_cmd() {
  if [[ "$test_only" == "true" ]]; then
    "$DOCKER_BIN" "$@"
  else
    "$DOCKER_BIN" --context default "$@"
  fi
}

curl_cmd() {
  "$CURL_BIN" "$@"
}

declare -A candidate_receipt=()
declare -A backup_receipt=()

attestation_file() {
  local label="$1"
  local supplied_path="$2"
  local supplied_hash="$3"
  local canonical_root canonical_path owner mode actual_hash
  [[ -n "$supplied_path" ]] || die "${label}_ATTESTATION_REQUIRED"
  [[ "$supplied_hash" =~ ^[a-f0-9]{64}$ ]] || die "${label}_ATTESTATION_HASH_INVALID"
  [[ -f "$supplied_path" && ! -L "$supplied_path" ]] || die "${label}_ATTESTATION_FILE_INVALID"
  canonical_path="$(canonical_existing_path "$supplied_path")" || die "${label}_ATTESTATION_UNRESOLVED"
  if [[ "$test_only" == "true" ]]; then
    canonical_root="$(canonical_existing_path "$fixture_root/attestations")" || die "TEST_ATTESTATION_ROOT_INVALID"
  else
    canonical_root="$(realpath -e -- "$RELEASE_ROOT/attestations")" || die "ATTESTATION_ROOT_UNRESOLVED"
  fi
  if [[ "$test_only" == "true" && ( "$OSTYPE" == msys* || "$OSTYPE" == cygwin* ) ]]; then
    case "$canonical_path" in "$canonical_root"\\*) ;; *) die "${label}_ATTESTATION_OUTSIDE_ROOT" ;; esac
  else
    case "$canonical_path/" in "$canonical_root"/*) ;; *) die "${label}_ATTESTATION_OUTSIDE_ROOT" ;; esac
  fi
  owner="$(stat -c '%U:%G' "$canonical_path")" || die "${label}_ATTESTATION_METADATA_UNREADABLE"
  mode="$(stat -c '%a' "$canonical_path")" || die "${label}_ATTESTATION_METADATA_UNREADABLE"
  [[ "$mode" == "600" ]] || die "${label}_ATTESTATION_MODE_INVALID"
  [[ "$test_only" == "true" || "$owner" == "hub:hub" ]] || die "${label}_ATTESTATION_OWNER_INVALID"
  actual_hash="$(sha256sum < "$canonical_path" | awk '{print $1}')" || die "${label}_ATTESTATION_HASH_UNREADABLE"
  [[ "$actual_hash" == "$supplied_hash" ]] || die "${label}_ATTESTATION_HASH_MISMATCH"
  printf '%s' "$canonical_path"
}

parse_attestation() {
  local label="$1"
  local attestation="$2"
  local allowed="$3"
  local -n destination="$4"
  local line key value
  destination=()
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[A-Z0-9_]+=[^=[:cntrl:]]+$ ]] || die "${label}_ATTESTATION_FORMAT_INVALID"
    key="${line%%=*}"
    value="${line#*=}"
    case " $allowed " in *" $key "*) ;; *) die "${label}_ATTESTATION_UNKNOWN_KEY" ;; esac
    [[ -z "${destination[$key]+present}" ]] || die "${label}_ATTESTATION_DUPLICATE_KEY"
    destination["$key"]="$value"
  done < "$attestation"
}

require_receipt_keys() {
  local label="$1"
  local -n receipt="$2"
  shift 2
  local key
  for key in "$@"; do
    [[ -n "${receipt[$key]+present}" ]] || die "${label}_ATTESTATION_MISSING_KEY"
  done
}

validate_backup_attestation_window() {
  local issued_at="$1"
  local expires_at="$2"
  local issued_epoch expires_epoch now_epoch
  issued_epoch="$(date -u -d "$issued_at" +%s 2>/dev/null)" || die "BACKUP_ATTESTATION_TIMESTAMP_INVALID"
  expires_epoch="$(date -u -d "$expires_at" +%s 2>/dev/null)" || die "BACKUP_ATTESTATION_TIMESTAMP_INVALID"
  now_epoch="$(date -u +%s)"
  (( issued_epoch <= now_epoch )) || die "BACKUP_ATTESTATION_ISSUED_IN_FUTURE"
  (( issued_epoch < expires_epoch && expires_epoch > now_epoch )) || die "BACKUP_ATTESTATION_EXPIRED"
  (( expires_epoch - issued_epoch <= 3600 )) || die "BACKUP_ATTESTATION_LIFETIME_INVALID"
}

validate_attestations() {
  candidate_attestation="$(attestation_file CANDIDATE "$candidate_attestation_arg" "$candidate_attestation_sha256_arg")"
  backup_attestation="$(attestation_file BACKUP "$backup_attestation_arg" "$backup_attestation_sha256_arg")"
  parse_attestation CANDIDATE "$candidate_attestation" "CANDIDATE_PATH PACKAGE_VERSION GIT_HEAD GIT_TREE ARCHIVE_SHA256 VERIFIER_SHA256 IMAGE_TAG IMAGE_ID COMPOSE_SHA256 ENVIRONMENT_SHA256 MIGRATIONS_SHA256" candidate_receipt
  require_receipt_keys CANDIDATE candidate_receipt CANDIDATE_PATH PACKAGE_VERSION GIT_HEAD GIT_TREE ARCHIVE_SHA256 VERIFIER_SHA256 IMAGE_TAG IMAGE_ID COMPOSE_SHA256 ENVIRONMENT_SHA256 MIGRATIONS_SHA256
  local attested_candidate_path attested_candidate_receipt_path
  attested_candidate_path="$(canonical_existing_path "${candidate_receipt[CANDIDATE_PATH]}")" || die "CANDIDATE_ATTESTATION_PATH_MISMATCH"
  [[ "$attested_candidate_path" == "$candidate" ]] || die "CANDIDATE_ATTESTATION_PATH_MISMATCH"
  [[ "${candidate_receipt[PACKAGE_VERSION]}" == "$candidate_version" ]] || die "CANDIDATE_ATTESTATION_VERSION_MISMATCH"
  [[ "${candidate_receipt[IMAGE_TAG]}" == "hub-turismo-amazonas:$candidate_version" && "${candidate_receipt[IMAGE_ID]}" == "$candidate_image_id" ]] || die "CANDIDATE_ATTESTATION_IMAGE_MISMATCH"
  [[ "${candidate_receipt[COMPOSE_SHA256]}" == "$candidate_compose_hash" ]] || die "CANDIDATE_ATTESTATION_COMPOSE_MISMATCH"
  [[ "${candidate_receipt[ENVIRONMENT_SHA256]}" == "$candidate_env_fingerprint" ]] || die "CANDIDATE_ATTESTATION_ENVIRONMENT_MISMATCH"
  [[ "${candidate_receipt[MIGRATIONS_SHA256]}" == "$candidate_migrations" ]] || die "CANDIDATE_ATTESTATION_MIGRATIONS_MISMATCH"
  [[ "${candidate_receipt[GIT_HEAD]}" =~ ^([a-f0-9]{40}|[a-f0-9]{64})$ && "${candidate_receipt[GIT_TREE]}" =~ ^([a-f0-9]{40}|[a-f0-9]{64})$ && "${candidate_receipt[ARCHIVE_SHA256]}" =~ ^[a-f0-9]{64}$ && "${candidate_receipt[VERIFIER_SHA256]}" =~ ^[a-f0-9]{64}$ ]] || die "CANDIDATE_ATTESTATION_VALUE_INVALID"

  parse_attestation BACKUP "$backup_attestation" "CANDIDATE_ATTESTATION_PATH CANDIDATE_ATTESTATION_SHA256 CANDIDATE_VERSION CANDIDATE_IMAGE_ID DUMP_FILE DUMP_SHA256 SOURCE_RECEIPT_FILE SOURCE_RECEIPT_SHA256 SOURCE_COUNTS SOURCE_LEDGER_SHA256 RESTORE_SOURCE_COMPARISON RESTORE_DATABASE_CLEANUP REMOTE_STAGING_CLEANUP ISSUED_AT_UTC EXPIRES_AT_UTC" backup_receipt
  require_receipt_keys BACKUP backup_receipt CANDIDATE_ATTESTATION_PATH CANDIDATE_ATTESTATION_SHA256 CANDIDATE_VERSION CANDIDATE_IMAGE_ID DUMP_FILE DUMP_SHA256 SOURCE_RECEIPT_FILE SOURCE_RECEIPT_SHA256 SOURCE_COUNTS SOURCE_LEDGER_SHA256 RESTORE_SOURCE_COMPARISON RESTORE_DATABASE_CLEANUP REMOTE_STAGING_CLEANUP ISSUED_AT_UTC EXPIRES_AT_UTC
  attested_candidate_receipt_path="$(canonical_existing_path "${backup_receipt[CANDIDATE_ATTESTATION_PATH]}")" || die "BACKUP_ATTESTATION_CANDIDATE_BINDING_MISMATCH"
  [[ "$attested_candidate_receipt_path" == "$candidate_attestation" && "${backup_receipt[CANDIDATE_ATTESTATION_SHA256]}" == "$candidate_attestation_sha256_arg" ]] || die "BACKUP_ATTESTATION_CANDIDATE_BINDING_MISMATCH"
  [[ "${backup_receipt[CANDIDATE_VERSION]}" == "$candidate_version" && "${backup_receipt[CANDIDATE_IMAGE_ID]}" == "$candidate_image_id" ]] || die "BACKUP_ATTESTATION_CANDIDATE_MISMATCH"
  [[ "${backup_receipt[RESTORE_SOURCE_COMPARISON]}" == "match" && "${backup_receipt[RESTORE_DATABASE_CLEANUP]}" == "ok" && "${backup_receipt[REMOTE_STAGING_CLEANUP]}" == "ok" ]] || die "BACKUP_ATTESTATION_RESTORE_INVALID"
  [[ "${backup_receipt[DUMP_SHA256]}" =~ ^[a-f0-9]{64}$ && "${backup_receipt[SOURCE_RECEIPT_SHA256]}" =~ ^[a-f0-9]{64}$ && "${backup_receipt[SOURCE_LEDGER_SHA256]}" =~ ^[a-f0-9]{64}$ && "${backup_receipt[SOURCE_COUNTS]}" =~ ^\{.*\}$ ]] || die "BACKUP_ATTESTATION_VALUE_INVALID"
  [[ "${backup_receipt[ISSUED_AT_UTC]}" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?Z$ && "${backup_receipt[EXPIRES_AT_UTC]}" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?Z$ ]] || die "BACKUP_ATTESTATION_TIMESTAMP_INVALID"
  validate_backup_attestation_window "${backup_receipt[ISSUED_AT_UTC]}" "${backup_receipt[EXPIRES_AT_UTC]}"
}

preflight_attestation_inputs() {
  candidate_attestation="$(attestation_file CANDIDATE "$candidate_attestation_arg" "$candidate_attestation_sha256_arg")"
  backup_attestation="$(attestation_file BACKUP "$backup_attestation_arg" "$backup_attestation_sha256_arg")"
  parse_attestation CANDIDATE "$candidate_attestation" "CANDIDATE_PATH PACKAGE_VERSION GIT_HEAD GIT_TREE ARCHIVE_SHA256 VERIFIER_SHA256 IMAGE_TAG IMAGE_ID COMPOSE_SHA256 ENVIRONMENT_SHA256 MIGRATIONS_SHA256" candidate_receipt
  require_receipt_keys CANDIDATE candidate_receipt CANDIDATE_PATH PACKAGE_VERSION GIT_HEAD GIT_TREE ARCHIVE_SHA256 VERIFIER_SHA256 IMAGE_TAG IMAGE_ID COMPOSE_SHA256 ENVIRONMENT_SHA256 MIGRATIONS_SHA256
  parse_attestation BACKUP "$backup_attestation" "CANDIDATE_ATTESTATION_PATH CANDIDATE_ATTESTATION_SHA256 CANDIDATE_VERSION CANDIDATE_IMAGE_ID DUMP_FILE DUMP_SHA256 SOURCE_RECEIPT_FILE SOURCE_RECEIPT_SHA256 SOURCE_COUNTS SOURCE_LEDGER_SHA256 RESTORE_SOURCE_COMPARISON RESTORE_DATABASE_CLEANUP REMOTE_STAGING_CLEANUP ISSUED_AT_UTC EXPIRES_AT_UTC" backup_receipt
  require_receipt_keys BACKUP backup_receipt CANDIDATE_ATTESTATION_PATH CANDIDATE_ATTESTATION_SHA256 CANDIDATE_VERSION CANDIDATE_IMAGE_ID DUMP_FILE DUMP_SHA256 SOURCE_RECEIPT_FILE SOURCE_RECEIPT_SHA256 SOURCE_COUNTS SOURCE_LEDGER_SHA256 RESTORE_SOURCE_COMPARISON RESTORE_DATABASE_CLEANUP REMOTE_STAGING_CLEANUP ISSUED_AT_UTC EXPIRES_AT_UTC
  local attested_candidate_path candidate_version_from_disk attested_candidate_receipt_path
  attested_candidate_path="$(canonical_existing_path "${candidate_receipt[CANDIDATE_PATH]}")" || die "CANDIDATE_ATTESTATION_PATH_MISMATCH"
  [[ "$attested_candidate_path" == "$candidate" ]] || die "CANDIDATE_ATTESTATION_PATH_MISMATCH"
  candidate_version_from_disk="$(package_version "$candidate")"
  [[ "${candidate_receipt[PACKAGE_VERSION]}" == "$candidate_version_from_disk" && "${backup_receipt[CANDIDATE_VERSION]}" == "$candidate_version_from_disk" ]] || die "CANDIDATE_ATTESTATION_VERSION_MISMATCH"
  [[ "${candidate_receipt[IMAGE_TAG]}" == "hub-turismo-amazonas:$candidate_version_from_disk" ]] || die "CANDIDATE_ATTESTATION_IMAGE_TAG_INVALID"
  [[ "${candidate_receipt[IMAGE_ID]}" =~ ^sha256:[a-f0-9]{64}$ ]] || die "CANDIDATE_ATTESTATION_IMAGE_ID_INVALID"
  [[ "${candidate_receipt[GIT_HEAD]}" =~ ^([a-f0-9]{40}|[a-f0-9]{64})$ ]] || die "CANDIDATE_ATTESTATION_GIT_HEAD_INVALID"
  [[ "${candidate_receipt[GIT_TREE]}" =~ ^([a-f0-9]{40}|[a-f0-9]{64})$ ]] || die "CANDIDATE_ATTESTATION_GIT_TREE_INVALID"
  [[ "${candidate_receipt[ARCHIVE_SHA256]}" =~ ^[a-f0-9]{64}$ ]] || die "CANDIDATE_ATTESTATION_ARCHIVE_HASH_INVALID"
  [[ "${candidate_receipt[VERIFIER_SHA256]}" =~ ^[a-f0-9]{64}$ ]] || die "CANDIDATE_ATTESTATION_VERIFIER_HASH_INVALID"
  [[ "${candidate_receipt[COMPOSE_SHA256]}" =~ ^[a-f0-9]{64}$ ]] || die "CANDIDATE_ATTESTATION_COMPOSE_HASH_INVALID"
  [[ "${candidate_receipt[ENVIRONMENT_SHA256]}" =~ ^[a-f0-9]{64}$ ]] || die "CANDIDATE_ATTESTATION_ENVIRONMENT_HASH_INVALID"
  [[ "${candidate_receipt[MIGRATIONS_SHA256]}" =~ ^[a-f0-9]{64}$ ]] || die "CANDIDATE_ATTESTATION_MIGRATIONS_HASH_INVALID"
  attested_candidate_receipt_path="$(canonical_existing_path "${backup_receipt[CANDIDATE_ATTESTATION_PATH]}")" || die "BACKUP_ATTESTATION_CANDIDATE_BINDING_MISMATCH"
  [[ "$attested_candidate_receipt_path" == "$candidate_attestation" && "${backup_receipt[CANDIDATE_ATTESTATION_SHA256]}" == "$candidate_attestation_sha256_arg" ]] || die "BACKUP_ATTESTATION_CANDIDATE_BINDING_MISMATCH"
  [[ "${backup_receipt[CANDIDATE_ATTESTATION_SHA256]}" =~ ^[a-f0-9]{64}$ ]] || die "BACKUP_ATTESTATION_CANDIDATE_HASH_INVALID"
  [[ "${backup_receipt[CANDIDATE_IMAGE_ID]}" =~ ^sha256:[a-f0-9]{64}$ ]] || die "BACKUP_ATTESTATION_IMAGE_ID_INVALID"
  [[ "${backup_receipt[DUMP_FILE]}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*\.dump$ ]] || die "BACKUP_ATTESTATION_DUMP_FILE_INVALID"
  [[ "${backup_receipt[SOURCE_RECEIPT_FILE]}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*\.source\.json$ ]] || die "BACKUP_ATTESTATION_SOURCE_RECEIPT_FILE_INVALID"
  [[ "${backup_receipt[DUMP_SHA256]}" =~ ^[a-f0-9]{64}$ && "${backup_receipt[SOURCE_RECEIPT_SHA256]}" =~ ^[a-f0-9]{64}$ && "${backup_receipt[SOURCE_LEDGER_SHA256]}" =~ ^[a-f0-9]{64}$ ]] || die "BACKUP_ATTESTATION_HASH_INVALID"
  source_counts_validator='const fs=require("fs"); const text=fs.readFileSync(0,"utf8"); let value; try { value=JSON.parse(text); } catch { process.exit(1) }; const keys=Object.keys(value||{}); if (Object.getPrototypeOf(value)!==Object.prototype || keys.some((key,index)=>key!==[...keys].sort()[index] || !/^(0|[1-9]\d*)$/.test(value[key])) || JSON.stringify(value)!==text) process.exit(1);'
  if [[ "$test_only" == "true" ]]; then
    printf '%s' "${backup_receipt[SOURCE_COUNTS]}" | node -e "$source_counts_validator" || die "BACKUP_ATTESTATION_SOURCE_COUNTS_INVALID"
  else
    previous_web_id="$(service_id "$previous" "$APP_SERVICE")"
    printf '%s' "${backup_receipt[SOURCE_COUNTS]}" | docker_cmd exec -i "$previous_web_id" node -e "$source_counts_validator" || die "BACKUP_ATTESTATION_SOURCE_COUNTS_INVALID"
  fi
  [[ "${backup_receipt[RESTORE_SOURCE_COMPARISON]}" == "match" && "${backup_receipt[RESTORE_DATABASE_CLEANUP]}" == "ok" && "${backup_receipt[REMOTE_STAGING_CLEANUP]}" == "ok" ]] || die "BACKUP_ATTESTATION_RESTORE_INVALID"
  [[ "${backup_receipt[ISSUED_AT_UTC]}" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?Z$ && "${backup_receipt[EXPIRES_AT_UTC]}" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?Z$ ]] || die "BACKUP_ATTESTATION_TIMESTAMP_INVALID"
  validate_backup_attestation_window "${backup_receipt[ISSUED_AT_UTC]}" "${backup_receipt[EXPIRES_AT_UTC]}"
}

release_file_checks() {
  local release="$1"
  [[ -d "$release/infra" && ! -L "$release/infra" ]] || die "RELEASE_INFRA_DIRECTORY_INVALID"
  [[ -d "$release/db" && ! -L "$release/db" ]] || die "RELEASE_DATABASE_DIRECTORY_INVALID"
  for file in package.json infra/compose.vps.yaml infra/vps.env; do
    [[ -f "$release/$file" && ! -L "$release/$file" ]] || die "RELEASE_FILE_INVALID"
  done
  if [[ "$test_only" != "true" ]]; then
    local env_owner env_mode compose_owner compose_mode
    env_owner="$(stat -c '%U:%G' "$release/infra/vps.env")" || die "ENV_METADATA_UNREADABLE"
    env_mode="$(stat -c '%a' "$release/infra/vps.env")" || die "ENV_METADATA_UNREADABLE"
    [[ "$env_owner" == "hub:hub" && "$env_mode" == "600" ]] || die "ENV_PERMISSIONS_INVALID"
    compose_owner="$(stat -c '%U:%G' "$release/infra/compose.vps.yaml")" || die "COMPOSE_METADATA_UNREADABLE"
    compose_mode="$(stat -c '%a' "$release/infra/compose.vps.yaml")" || die "COMPOSE_METADATA_UNREADABLE"
    [[ "$compose_owner" == "hub:hub" ]] || die "COMPOSE_OWNER_INVALID"
    (( (8#$compose_mode & 0022) == 0 )) || die "COMPOSE_PERMISSIONS_INVALID"
  fi
}

package_version() {
  local release="$1"
  local -a versions
  mapfile -t versions < <(awk -F '"' '/^[[:space:]]*"version"[[:space:]]*:/ { print $4 }' "$release/package.json")
  [[ "${#versions[@]}" -eq 1 && "${versions[0]}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "PACKAGE_VERSION_INVALID"
  printf '%s' "${versions[0]}"
}

env_version() {
  local release="$1"
  local version
  version="$(awk -F= '$1 == "APP_VERSION" { count++; value = substr($0, index($0, "=") + 1) } END { if (count != 1) exit 1; print value }' "$release/infra/vps.env")" || die "APP_VERSION_ENV_INVALID"
  [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "APP_VERSION_ENV_INVALID"
  printf '%s' "$version"
}

environment_fingerprint() {
  local release="$1"
  grep -v '^[[:space:]]*APP_VERSION=' "$release/infra/vps.env" | sha256sum | awk '{print $1}'
}

migration_fingerprint() {
  local release="$1"
  local file_count
  [[ -d "$release/db/migrations" && -d "$release/db/postgres-migrations" ]] || die "MIGRATION_DIRECTORIES_MISSING"
  [[ ! -L "$release/db/migrations" && ! -L "$release/db/postgres-migrations" ]] || die "MIGRATION_DIRECTORY_SYMLINK"
  if find "$release/db/migrations" "$release/db/postgres-migrations" -type l -print -quit | grep -q .; then
    die "MIGRATION_FILE_SYMLINK"
  fi
  file_count="$(find "$release/db/migrations" "$release/db/postgres-migrations" -type f -name '*.sql' | wc -l | tr -d '[:space:]')"
  [[ "$file_count" -gt 0 ]] || die "MIGRATION_SET_EMPTY"
  (
    cd "$release"
    find db/migrations db/postgres-migrations -type f -name '*.sql' -print0 |
      sort -z | xargs -0 sha256sum | sha256sum | awk '{print $1}'
  )
}

compose_args_for() {
  local release="$1"
  COMPOSE_ARGS=(-p "$PROJECT" --env-file "$release/infra/vps.env" -f "$release/infra/compose.vps.yaml")
}

service_id() {
  local release="$1"
  local service="$2"
  local ids
  compose_args_for "$release"
  ids="$(docker_cmd compose "${COMPOSE_ARGS[@]}" ps -q "$service" 2>/dev/null)" || die "SERVICE_LOOKUP_FAILED"
  [[ "$(printf '%s\n' "$ids" | sed '/^[[:space:]]*$/d' | wc -l | tr -d '[:space:]')" == "1" ]] || die "EXPECTED_ONE_SERVICE_CONTAINER"
  printf '%s' "$ids"
}

container_health() {
  docker_cmd inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}not-configured{{end}}' "$1" 2>/dev/null || die "CONTAINER_HEALTH_UNREADABLE"
}

postgres_snapshot() {
  local release="$1"
  local pg_id pg_image pg_health pg_volume
  pg_id="$(service_id "$release" postgres)"
  pg_image="$(docker_cmd inspect --format '{{.Config.Image}}' "$pg_id" 2>/dev/null)" || die "POSTGRES_IMAGE_UNREADABLE"
  pg_health="$(container_health "$pg_id")"
  [[ "$pg_health" == "healthy" ]] || die "POSTGRES_NOT_HEALTHY"
  pg_volume="$(docker_cmd inspect --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql"}}{{.Name}}{{end}}{{end}}' "$pg_id" 2>/dev/null)" || die "POSTGRES_VOLUME_UNREADABLE"
  [[ -n "$pg_volume" ]] || die "POSTGRES_VOLUME_MISSING"
  printf '%s|%s|%s|%s' "$pg_id" "$pg_image" "$pg_health" "$pg_volume"
}

verify_migration_ledger() {
  local web_id="$1"
  local report json_line expected_count actual_count
  report="$(docker_cmd exec "$web_id" node --experimental-strip-types /app/scripts/verify-postgres-migration-ledger.ts 2>/dev/null)" || die "MIGRATION_LEDGER_MISMATCH"
  json_line="$(head -n1 <<<"$report")"
  grep -Eq '^\{"expectedCount":[0-9]+,"actualCount":[0-9]+,"missing":\[\],"extra":\[\],"mismatched":\[\]\}$' <<<"$json_line" || die "MIGRATION_LEDGER_MISMATCH"
  expected_count="$(sed -nE 's/.*"expectedCount":([0-9]+).*/\1/p' <<<"$json_line")"
  actual_count="$(sed -nE 's/.*"actualCount":([0-9]+).*/\1/p' <<<"$json_line")"
  [[ "$expected_count" =~ ^[0-9]+$ && "$actual_count" == "$expected_count" ]] || die "MIGRATION_LEDGER_MISMATCH"
  grep -Fxq 'POSTGRES_MIGRATION_LEDGER=match' <<<"$report" || die "MIGRATION_LEDGER_MISMATCH"
}

database_snapshot() {
  local web_id="$1"
  local report counts ledger_hash
  report="$(docker_cmd exec -i "$web_id" node --input-type=module - 2>/dev/null <<'NODE'
import { createHash } from "node:crypto";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
try {
  const tableResult = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> 'schema_migrations' ORDER BY table_name",
  );
  const counts = {};
  for (const { table_name: tableName } of tableResult.rows) {
    const quoted = '"' + tableName.replaceAll('"', '""') + '"';
    const result = await pool.query(`SELECT count(*)::text AS count FROM public.${quoted}`);
    counts[tableName] = result.rows[0].count;
  }
  const ledger = await pool.query("SELECT name, checksum FROM schema_migrations ORDER BY name");
  console.log("DB_COUNTS=" + JSON.stringify(counts));
  console.log("LEDGER_SHA256=" + createHash("sha256").update(JSON.stringify(ledger.rows)).digest("hex"));
} finally {
  await pool.end();
}
NODE
)" || die "DATABASE_SNAPSHOT_FAILED"
  counts="$(sed -n 's/^DB_COUNTS=//p' <<<"$report")"
  ledger_hash="$(sed -n 's/^LEDGER_SHA256=//p' <<<"$report")"
  [[ -n "$counts" && "$ledger_hash" =~ ^[a-f0-9]{64}$ ]] || die "DATABASE_SNAPSHOT_INVALID"
  printf '%s|%s' "$counts" "$ledger_hash"
}

wait_container_healthy() {
  local container="$1"
  local attempt health
  for attempt in {1..45}; do
    health="$(container_health "$container")" || return 1
    [[ "$health" == "healthy" ]] && return 0
    sleep 2
  done
  return 1
}

verify_app_health() {
  local release="$1"
  local expected_version="$2"
  local web_id worker_id payload
  web_id="$(service_id "$release" "$APP_SERVICE")"
  worker_id="$(service_id "$release" "$WORKER_SERVICE")"
  wait_container_healthy "$web_id" || die "WEB_CONTAINER_UNHEALTHY"
  wait_container_healthy "$worker_id" || die "WORKER_CONTAINER_UNHEALTHY"
  payload="$(curl_cmd --fail --silent --show-error --max-time 5 http://127.0.0.1:3005/api/health 2>/dev/null)" || die "WEB_HEALTH_ENDPOINT_FAILED"
  local version_pattern escaped_version
  escaped_version="${expected_version//./\\.}"
  version_pattern="^\\{\"status\":\"ok\",\"version\":\"$escaped_version\",\"database\":\"postgresql\"\\}$"
  grep -Eq "$version_pattern" <<<"$payload" || die "WEB_HEALTH_PAYLOAD_INVALID"
  docker_cmd exec "$web_id" node /app/scripts/verify-vps-health.mjs http://127.0.0.1:3000 >/dev/null 2>&1 || die "WEB_RUNTIME_HEALTH_FAILED"
  local worker_report
  worker_report="$(docker_cmd exec "$worker_id" node --experimental-strip-types /app/scripts/check-booking-worker-health.ts 2>/dev/null)" || die "WORKER_HEARTBEAT_FAILED"
  grep -Fq 'booking_email_worker_health_check_ok' <<<"$worker_report" || die "WORKER_HEARTBEAT_FAILED"
  verify_migration_ledger "$web_id"
  verify_public_health "$release" "$expected_version"
  printf '%s|%s' "$web_id" "$worker_id"
}

verify_public_health() {
  local release="$1"
  local expected_version="$2"
  local site_url payload status response escaped_version version_pattern
  site_url="$(awk -F= '$1 == "SITE_URL" { count++; value=substr($0, index($0, "=") + 1) } END { if (count != 1) exit 1; print value }' "$release/infra/vps.env")" || die "SITE_URL_INVALID"
  [[ "$site_url" =~ ^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?$ ]] || die "SITE_URL_INVALID"
  response="$(curl_cmd --silent --show-error --connect-timeout 5 --max-time 10 --proto '=https' --proto-redir '=https' --max-redirs 0 --write-out $'\n%{http_code}' "$site_url/api/health" 2>/dev/null)" || die "PUBLIC_HEALTH_TRANSPORT_FAILED"
  status="${response##*$'\n'}"
  payload="${response%$'\n'*}"
  [[ "$status" == "200" ]] || die "PUBLIC_HEALTH_STATUS_INVALID"
  escaped_version="${expected_version//./\\.}"
  version_pattern="^\\{\"status\":\"ok\",\"version\":\"$escaped_version\",\"database\":\"postgresql\"\\}$"
  grep -Eq "$version_pattern" <<<"$payload" || die "PUBLIC_HEALTH_PAYLOAD_INVALID"
}

validate_release() {
  local release="$1"
  local version image image_id images app_image_count services expected_services
  release_file_checks "$release"
  version="$(package_version "$release")"
  [[ "$(env_version "$release")" == "$version" ]] || die "PACKAGE_AND_ENV_VERSION_MISMATCH"
  compose_args_for "$release"
  docker_cmd compose "${COMPOSE_ARGS[@]}" config --quiet >/dev/null 2>&1 || die "COMPOSE_CONFIGURATION_INVALID"
  services="$(docker_cmd compose "${COMPOSE_ARGS[@]}" config --services 2>/dev/null)" || die "COMPOSE_SERVICE_LIST_FAILED"
  expected_services="$(printf '%s\n' "$APP_SERVICE" "$WORKER_SERVICE" postgres | LC_ALL=C sort)"
  [[ "$(printf '%s\n' "$services" | sed '/^[[:space:]]*$/d' | LC_ALL=C sort)" == "$expected_services" ]] || die "COMPOSE_SERVICE_SET_INVALID"
  images="$(docker_cmd compose "${COMPOSE_ARGS[@]}" config --images 2>/dev/null)" || die "COMPOSE_IMAGE_LIST_FAILED"
  image="hub-turismo-amazonas:$version"
  app_image_count="$(grep -Fxc "$image" <<<"$images" || true)"
  [[ "$app_image_count" == "2" ]] || die "COMPOSE_APP_IMAGE_MISMATCH"
  image_id="$(docker_cmd image inspect --format '{{.Id}}' "$image" 2>/dev/null)" || die "RELEASE_IMAGE_MISSING"
  [[ -n "$image_id" ]] || die "RELEASE_IMAGE_MISSING"
  printf '%s|%s' "$version" "$image_id"
}

atomic_set_current() {
  local target="$1"
  local activation_parent link
  activation_parent="$(dirname -- "$current")"
  if [[ "$test_only" == "true" && ( "$OSTYPE" == msys* || "$OSTYPE" == cygwin* ) ]]; then
    [[ -L "$current" ]] || die "TEST_CURRENT_LINK_INVALID"
    local current_target
    current_target="$(canonical_existing_path "$current")" || die "TEST_CURRENT_TARGET_INVALID"
    [[ "$current_target" == "$candidate" || "$current_target" == "$previous" ]] || die "TEST_CURRENT_TARGET_INVALID"
    [[ -f "$fake_bin/set-current.ps1" && ! -L "$fake_bin/set-current.ps1" ]] || die "TEST_LINK_HELPER_INVALID"
    grep -Fq "$EXPECTED_FAKE_SENTINEL" "$fake_bin/set-current.ps1" || die "TEST_LINK_HELPER_SENTINEL_INVALID"
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(cygpath -w "$fake_bin/set-current.ps1")" \
      -FixtureRoot "$(cygpath -w "$fixture_root")" -Current "$(cygpath -w "$current")" \
      -Target "$(cygpath -w "$target")" >/dev/null || die "TEST_CURRENT_LINK_SWITCH_FAILED"
    return
  fi
  link="$activation_parent/.current-activation.$$"
  [[ ! -e "$link" && ! -L "$link" ]] || die "ACTIVATION_TEMP_PATH_EXISTS"
  ln -s "$target" "$link" || die "ACTIVATION_SYMLINK_CREATE_FAILED"
  if ! mv -Tf "$link" "$current"; then
    rm -f -- "$link"
    die "ACTIVATION_SYMLINK_SWITCH_FAILED"
  fi
}

run_compose_app_only() {
  local release="$1"
  compose_args_for "$release"
  docker_cmd compose "${COMPOSE_ARGS[@]}" up -d --no-deps --no-build "$APP_SERVICE" "$WORKER_SERVICE" >/dev/null || die "APP_ONLY_COMPOSE_UP_FAILED"
}

test_activate_app_only() {
  [[ "$test_only" == "true" ]] || die "TEST_ACTIVATION_NOT_ALLOWED"
  local release="$1"
  [[ "$release" == "$candidate" || "$release" == "$previous" ]] || die "TEST_RELEASE_PATH_INVALID"
  compose_args_for "$release"
  docker_cmd compose "${COMPOSE_ARGS[@]}" up -d --no-deps --no-build "$APP_SERVICE" "$WORKER_SERVICE" >/dev/null || die "FAKE_APP_ONLY_COMPOSE_UP_FAILED"
}

rollback_release() {
  local original_postgres="$1"
  local original_db="$2"
  atomic_set_current "$previous" || return 1
  if [[ "$test_only" == "true" ]]; then
    test_activate_app_only "$previous" || return 1
  else
    run_compose_app_only "$previous" || return 1
  fi
  local release_info previous_version
  release_info="$(validate_release "$previous")" || return 1
  previous_version="${release_info%%|*}"
  verify_app_health "$previous" "$previous_version" >/dev/null || return 1
  local postgres_after db_after
  postgres_after="$(postgres_snapshot "$previous")" || return 1
  db_after="$(database_snapshot "$(service_id "$previous" "$APP_SERVICE")")" || return 1
  [[ "$postgres_after" == "$original_postgres" && "$db_after" == "$original_db" ]] || return 1
  [[ "$(canonical_existing_path "$current")" == "$previous" ]] || return 1
  printf 'ROLLBACK=passed\nPREVIOUS_VERSION=%s\nDATABASE=preserved\nPOSTGRES=preserved\n' "$previous_version"
}

preflight_attestation_inputs
validate_release "$candidate" >/dev/null
candidate_info="$(validate_release "$candidate")"
candidate_version="${candidate_info%%|*}"
candidate_image_id="${candidate_info#*|}"
validate_release "$previous" >/dev/null
previous_info="$(validate_release "$previous")"
previous_version="${previous_info%%|*}"
previous_image_id="${previous_info#*|}"

candidate_env_fingerprint="$(environment_fingerprint "$candidate")"
previous_env_fingerprint="$(environment_fingerprint "$previous")"
[[ "$candidate_env_fingerprint" == "$previous_env_fingerprint" ]] || die "ENVIRONMENT_CONTENT_DRIFT"
candidate_migrations="$(migration_fingerprint "$candidate")"
previous_migrations="$(migration_fingerprint "$previous")"
[[ "$candidate_migrations" == "$previous_migrations" ]] || die "MIGRATION_SET_OR_CHECKSUM_DRIFT"
candidate_compose_hash="$(sha256sum < "$candidate/infra/compose.vps.yaml" | awk '{print $1}')"
previous_compose_hash="$(sha256sum < "$previous/infra/compose.vps.yaml" | awk '{print $1}')"
[[ "$candidate_compose_hash" == "$previous_compose_hash" ]] || die "COMPOSE_FILE_DRIFT"
validate_attestations

compose_args_for "$previous"
docker_cmd info >/dev/null 2>&1 || die "DOCKER_DAEMON_UNAVAILABLE"
docker_cmd compose "${COMPOSE_ARGS[@]}" config --quiet >/dev/null 2>&1 || die "PREVIOUS_COMPOSE_INVALID"
verify_migration_ledger "$(service_id "$previous" "$APP_SERVICE")"
postgres_before="$(postgres_snapshot "$previous")"
db_before="$(database_snapshot "$(service_id "$previous" "$APP_SERVICE")")"
verify_app_health "$previous" "$previous_version" >/dev/null
printf 'PREFLIGHT=passed\nPREVIOUS_VERSION=%s\nCANDIDATE_VERSION=%s\nPREVIOUS_IMAGE_ID=%s\nCANDIDATE_IMAGE_ID=%s\nPOSTGRES_SNAPSHOT=%s\nDATABASE_SNAPSHOT=%s\nPOSTGRES_MIGRATION_LEDGER=match\n' \
  "$previous_version" "$candidate_version" "$previous_image_id" "$candidate_image_id" \
  "$postgres_before" "$db_before"

if [[ "$test_only" == "true" ]]; then
  if [[ "$simulate_activate" != "true" ]]; then
    printf 'TEST_MODE=preflight-only\nCURRENT_UNCHANGED=ok\n'
    exit 0
  fi
else
  [[ "$mode" == "--activate" ]] || { printf 'CURRENT_UNCHANGED=ok\n'; exit 0; }
fi

activated=false
rollback_attempted=false

on_exit() {
  local original_status="$?"
  trap - EXIT
  if [[ "$activated" == "true" && "$original_status" -ne 0 && "$rollback_attempted" == "false" ]]; then
    rollback_attempted=true
    printf 'ACTIVATION=failed\nROLLBACK=started\n' >&2
    if (rollback_release "$postgres_before" "$db_before"); then
      printf 'ACTIVATION=failed\nROLLBACK=passed\n' >&2
    else
      printf 'ACTIVATION=failed\nROLLBACK=failed\nORIGINAL_EXIT=%s\n' "$original_status" >&2
      original_status=90
    fi
  fi
  exit "$original_status"
}
trap on_exit EXIT

[[ "$(canonical_existing_path "$current")" == "$previous" ]] || die "CURRENT_CHANGED_DURING_PREFLIGHT"
if [[ "$test_only" == "true" ]]; then
  atomic_set_current "$candidate"
  activated=true
  test_activate_app_only "$candidate"
else
  atomic_set_current "$candidate"
  activated=true
  run_compose_app_only "$candidate"
fi
candidate_app_ids="$(verify_app_health "$candidate" "$candidate_version")"
postgres_after="$(postgres_snapshot "$candidate")"
db_after="$(database_snapshot "$(service_id "$candidate" "$APP_SERVICE")")"
[[ "$postgres_after" == "$postgres_before" ]] || die "POSTGRES_INVARIANT_CHANGED"
[[ "$db_after" == "$db_before" ]] || die "DATABASE_INVARIANT_CHANGED"
current_after_activation="$(canonical_existing_path "$current")" || die "CURRENT_TARGET_UNRESOLVED"
[[ "$current_after_activation" == "$candidate" ]] || die "CURRENT_TARGET_MISMATCH"

activated=false
trap - EXIT
printf 'ACTIVATION=passed\nCANDIDATE_VERSION=%s\nWEB_WORKER=%s\nPOSTGRES=preserved\nDATABASE=preserved\nMIGRATIONS=unchanged\n' \
  "$candidate_version" "$candidate_app_ids"
