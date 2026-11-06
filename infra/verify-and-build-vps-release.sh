#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

RELEASE_ROOT="/opt/hub-turismo"
STAGING_ROOT="$RELEASE_ROOT/staging"
ATTESTATION_ROOT="$RELEASE_ROOT/attestations"
PROJECT="hub-turismo"
EXPECTED_TEST_SENTINEL="hub-verify-build-test-fixture-v1"
EXPECTED_FAKE_SENTINEL="hub-verify-build-fake-runtime-v1"

die() {
  printf 'ERROR=%s\n' "$1" >&2
  exit 1
}

usage() {
  cat <<'USAGE'
Production:
  verify-and-build-vps-release.sh --staging PATH --archive PATH --manifest PATH --verifier PATH \
    --git-head SHA --git-tree SHA --archive-sha256 SHA256 --verifier-sha256 SHA256 \
    [--helper-tarball package=PATH]

Disposable test fixture only:
  verify-and-build-vps-release.sh --test-only --fixture-root PATH --fake-bin PATH \
    --staging PATH --archive PATH --manifest PATH --verifier PATH \
    --git-head SHA --git-tree SHA --archive-sha256 SHA256 --verifier-sha256 SHA256
USAGE
}

test_only=false
fixture_root_arg=""
fake_bin_arg=""
staging_arg=""
archive_arg=""
manifest_arg=""
verifier_arg=""
git_head=""
git_tree=""
archive_sha256=""
verifier_sha256=""
declare -a helper_args=()

while (($#)); do
  case "$1" in
    --test-only) test_only=true; shift ;;
    --fixture-root|--fake-bin|--staging|--archive|--manifest|--verifier|--git-head|--git-tree|--archive-sha256|--verifier-sha256)
      (($# >= 2)) || die "MISSING_OPTION_VALUE"
      key="$1"; value="$2"; shift 2
      case "$key" in
        --fixture-root) fixture_root_arg="$value" ;;
        --fake-bin) fake_bin_arg="$value" ;;
        --staging) staging_arg="$value" ;;
        --archive) archive_arg="$value" ;;
        --manifest) manifest_arg="$value" ;;
        --verifier) verifier_arg="$value" ;;
        --git-head) git_head="$value" ;;
        --git-tree) git_tree="$value" ;;
        --archive-sha256) archive_sha256="$value" ;;
        --verifier-sha256) verifier_sha256="$value" ;;
      esac
      ;;
    --helper-tarball)
      (($# >= 2)) || die "MISSING_OPTION_VALUE"
      helper_args+=("$2"); shift 2
      ;;
    --help|-h) usage; exit 0 ;;
    *) usage >&2; die "UNKNOWN_OPTION" ;;
  esac
done

[[ -n "$staging_arg" && -n "$archive_arg" && -n "$manifest_arg" && -n "$verifier_arg" ]] || die "SOURCE_INPUTS_REQUIRED"
[[ "$git_head" =~ ^[a-f0-9]{40,64}$ && "$git_tree" =~ ^[a-f0-9]{40,64}$ ]] || die "GIT_PINS_INVALID"
[[ "$archive_sha256" =~ ^[a-f0-9]{64}$ ]] || die "ARCHIVE_SHA256_INVALID"
[[ "$verifier_sha256" =~ ^[a-f0-9]{64}$ ]] || die "VERIFIER_SHA256_INVALID"

canonical_existing() {
  realpath -e -- "$1"
}

assert_under() {
  local root="$1" value="$2" code="$3"
  case "$value/" in "$root"/*) ;; *) die "$code" ;; esac
}

assert_regular_input() {
  local value="$1" code="$2"
  [[ -f "$value" && ! -L "$value" ]] || die "$code"
  if [[ "$test_only" != true ]]; then
    local mode
    mode="$(stat -c '%a' "$value")" || die "INPUT_METADATA_UNREADABLE"
    (( (8#$mode & 0022) == 0 )) || die "INPUT_PERMISSIONS_INVALID"
  fi
}

if [[ "$test_only" == true ]]; then
  [[ -n "$fixture_root_arg" && -n "$fake_bin_arg" ]] || die "TEST_FIXTURE_ARGUMENTS_REQUIRED"
  case "$fixture_root_arg/" in /opt/hub-turismo/*|/opt/hub-turismo/) die "PRODUCTION_PATH_FORBIDDEN_IN_TEST_MODE" ;; esac
  fixture_root="$(canonical_existing "$fixture_root_arg")" || die "TEST_FIXTURE_ROOT_UNRESOLVED"
  [[ -d "$fixture_root" && ! -L "$fixture_root" ]] || die "TEST_FIXTURE_ROOT_INVALID"
  [[ -f "$fixture_root/.hub-verify-build-fixture" && ! -L "$fixture_root/.hub-verify-build-fixture" ]] || die "TEST_FIXTURE_SENTINEL_MISSING"
  grep -Fxq "$EXPECTED_TEST_SENTINEL" "$fixture_root/.hub-verify-build-fixture" || die "TEST_FIXTURE_SENTINEL_INVALID"
  fake_bin="$(canonical_existing "$fake_bin_arg")" || die "FAKE_BIN_UNRESOLVED"
  assert_under "$fixture_root" "$fake_bin" "FAKE_BIN_OUTSIDE_FIXTURE"
  [[ -f "$fake_bin/.hub-fake-runtime" && ! -L "$fake_bin/.hub-fake-runtime" ]] || die "FAKE_RUNTIME_SENTINEL_MISSING"
  grep -Fxq "$EXPECTED_FAKE_SENTINEL" "$fake_bin/.hub-fake-runtime" || die "FAKE_RUNTIME_SENTINEL_INVALID"
  for command in docker unzip; do
    [[ -f "$fake_bin/$command" && -x "$fake_bin/$command" && ! -L "$fake_bin/$command" ]] || die "FAKE_COMMAND_INVALID"
    grep -Fq "$EXPECTED_FAKE_SENTINEL" "$fake_bin/$command" || die "FAKE_COMMAND_SENTINEL_INVALID"
  done
  RELEASE_ROOT="$fixture_root"
  STAGING_ROOT="$fixture_root/staging"
  ATTESTATION_ROOT="$fixture_root/attestations"
  DOCKER_BIN="$fake_bin/docker"
  UNZIP_BIN="$fake_bin/unzip"
else
  [[ -z "$fixture_root_arg" && -z "$fake_bin_arg" ]] || die "TEST_FLAGS_FORBIDDEN_IN_PRODUCTION_MODE"
  [[ "$(id -un)" == hub ]] || die "RUN_AS_HUB_OPERATOR"
  DOCKER_BIN=docker
  UNZIP_BIN=unzip
  unset DOCKER_HOST DOCKER_CONTEXT COMPOSE_FILE COMPOSE_PROJECT_NAME
fi

staging="$(canonical_existing "$staging_arg")" || die "STAGING_UNRESOLVED"
[[ -d "$staging" && ! -L "$staging" ]] || die "STAGING_INVALID"
assert_under "$STAGING_ROOT" "$staging" "STAGING_OUTSIDE_ROOT"
archive="$(canonical_existing "$archive_arg")" || die "ARCHIVE_UNRESOLVED"
manifest="$(canonical_existing "$manifest_arg")" || die "MANIFEST_UNRESOLVED"
verifier="$(canonical_existing "$verifier_arg")" || die "VERIFIER_UNRESOLVED"
for source_input in "$archive" "$manifest" "$verifier"; do assert_under "$staging" "$source_input" "SOURCE_OUTSIDE_STAGING"; done
assert_regular_input "$archive" "ARCHIVE_INVALID"
assert_regular_input "$manifest" "MANIFEST_INVALID"
assert_regular_input "$verifier" "VERIFIER_INVALID"

current="$(canonical_existing "$RELEASE_ROOT/current")" || die "CURRENT_RELEASE_UNRESOLVED"
[[ -d "$current" && ! -L "$current" ]] || die "CURRENT_RELEASE_INVALID"
if [[ "$test_only" != true ]]; then
  case "$current" in "$RELEASE_ROOT"/release-[A-Za-z0-9][A-Za-z0-9._-]*) ;; *) die "CURRENT_RELEASE_OUTSIDE_ROOT" ;; esac
fi
[[ -f "$current/infra/vps.env" && ! -L "$current/infra/vps.env" ]] || die "CURRENT_ENV_INVALID"
[[ -f "$current/package-lock.json" && ! -L "$current/package-lock.json" ]] || die "CURRENT_LOCKFILE_INVALID"
prior_version="$(awk -F= '$1 == "APP_VERSION" { count++; value = substr($0, index($0, "=") + 1) } END { if (count != 1) exit 1; print value }' "$current/infra/vps.env")" || die "CURRENT_APP_VERSION_INVALID"
[[ "$prior_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "CURRENT_APP_VERSION_INVALID"
prior_image="hub-turismo-amazonas:$prior_version"

actual_archive_sha256="$(sha256sum "$archive" | awk '{print $1}')"
[[ "$actual_archive_sha256" == "$archive_sha256" ]] || die "ARCHIVE_SHA256_MISMATCH"
actual_verifier_sha256="$(sha256sum "$verifier" | awk '{print $1}')"
[[ "$actual_verifier_sha256" == "$verifier_sha256" ]] || die "VERIFIER_SHA256_MISMATCH"

declare -a helper_mounts=()
helper_root=""
cleanup_paths=()
cleanup() {
  local status=$?
  for path in "${cleanup_paths[@]:-}"; do
    case "$path" in "$RELEASE_ROOT"/.release-*|"$RELEASE_ROOT"/.helpers-*|"$ATTESTATION_ROOT"/.candidate-*) [[ -e "$path" || -L "$path" ]] && rm -rf -- "$path" ;; esac
  done
  exit "$status"
}
trap cleanup EXIT

if ((${#helper_args[@]})); then
  helper_root="$staging/.helpers-${RANDOM}-${RANDOM}"
  mkdir -m 700 -- "$helper_root"
  cleanup_paths+=("$helper_root")
  for helper in "${helper_args[@]}"; do
    package_name="${helper%%=*}"; tarball_arg="${helper#*=}"
    [[ "$helper" == *=* && "$package_name" =~ ^(@[a-z0-9._-]+/)?[a-z0-9._-]+$ ]] || die "HELPER_ARGUMENT_INVALID"
    tarball="$(canonical_existing "$tarball_arg")" || die "HELPER_TARBALL_UNRESOLVED"
    assert_under "$staging" "$tarball" "HELPER_OUTSIDE_STAGING"
    assert_regular_input "$tarball" "HELPER_TARBALL_INVALID"
    package_path="node_modules/$package_name"
    expected_helper="$(node -e 'const lock=require(process.argv[1]); const entry=lock.packages?.[process.argv[2]]; if (!entry?.version || !entry?.integrity) process.exit(2); process.stdout.write(`${entry.version}|${entry.integrity}`)' "$current/package-lock.json" "$package_path")" || die "HELPER_NOT_PINNED_IN_CURRENT_LOCK"
    helper_version="${expected_helper%%|*}"; helper_integrity="${expected_helper#*|}"
    [[ "$helper_integrity" == sha512-* ]] || die "HELPER_SRI_INVALID"
    expected_b64="${helper_integrity#sha512-}"
    actual_b64="$(openssl dgst -sha512 -binary "$tarball" | openssl base64 -A)" || die "HELPER_HASH_UNREADABLE"
    [[ "$actual_b64" == "$expected_b64" ]] || die "HELPER_SRI_MISMATCH"
    tar -xzf "$tarball" -C "$helper_root" || die "HELPER_EXTRACTION_FAILED"
    helper_directory="$helper_root/package"
    [[ -f "$helper_directory/package.json" && ! -L "$helper_directory/package.json" ]] || die "HELPER_PACKAGE_INVALID"
    node -e 'const p=require(process.argv[1]); if (p.name !== process.argv[2] || p.version !== process.argv[3] || typeof p.main !== "string" || !p.main) process.exit(2)' "$helper_directory/package.json" "$package_name" "$helper_version" || die "HELPER_METADATA_MISMATCH"
    helper_entry="$(node -e 'const p=require(process.argv[1]); process.stdout.write(p.main)' "$helper_directory/package.json")"
    [[ -f "$helper_directory/$helper_entry" && ! -L "$helper_directory/$helper_entry" ]] || die "HELPER_ENTRYPOINT_INVALID"
    helper_mounts+=(--mount "type=bind,src=$helper_directory,dst=/app/node_modules/$package_name,readonly")
  done
fi

verifier_archive="/app/tmp/release-audit/$(basename "$archive")"
verifier_manifest="/app/tmp/release-audit/$(basename "$manifest")"
verifier_entry="/app/scripts/verify-vps-source-snapshot.mjs"
"$DOCKER_BIN" run --pull=never --rm --network none --read-only \
  --mount "type=bind,src=$staging,dst=/app/tmp/release-audit,readonly" \
  --mount "type=bind,src=$verifier,dst=$verifier_entry,readonly" \
  "${helper_mounts[@]}" --entrypoint node "$prior_image" \
  "$verifier_entry" "$verifier_archive" "$verifier_manifest" "$git_head" "$git_tree" --self-check || die "VERIFIER_FAILED"

release_temporary="$RELEASE_ROOT/.release-${RANDOM}-${RANDOM}.tmp"
mkdir -m 700 -- "$release_temporary"
cleanup_paths+=("$release_temporary")
"$UNZIP_BIN" -q "$archive" -d "$release_temporary" || die "SOURCE_EXTRACTION_FAILED"
[[ -f "$release_temporary/package.json" && ! -L "$release_temporary/package.json" ]] || die "CANDIDATE_PACKAGE_INVALID"
package_version="$(node -e 'const p=require(process.argv[1]); if (!/^\d+\.\d+\.\d+$/.test(p.version)) process.exit(2); process.stdout.write(p.version)' "$release_temporary/package.json")" || die "CANDIDATE_VERSION_INVALID"
final_release="$RELEASE_ROOT/release-$package_version"
[[ ! -e "$ATTESTATION_ROOT/candidate-$package_version.env" && ! -L "$ATTESTATION_ROOT/candidate-$package_version.env" ]] || die "ATTESTATION_ALREADY_EXISTS"
[[ ! -e "$final_release" && ! -L "$final_release" ]] || die "FINAL_RELEASE_ALREADY_EXISTS"
[[ -f "$release_temporary/infra/compose.vps.yaml" && ! -L "$release_temporary/infra/compose.vps.yaml" ]] || die "CANDIDATE_COMPOSE_INVALID"
mkdir -p -m 700 -- "$release_temporary/infra"
env_temporary="$release_temporary/infra/vps.env.new"
awk -F= -v version="$package_version" '$1 == "APP_VERSION" { count++; print "APP_VERSION=" version; next } { print } END { if (count != 1) exit 1 }' "$current/infra/vps.env" > "$env_temporary" || die "CANDIDATE_ENV_INVALID"
mv -f -- "$env_temporary" "$release_temporary/infra/vps.env"
if [[ "$test_only" != true ]]; then
  chown hub:hub "$release_temporary/infra/vps.env" "$release_temporary/infra/compose.vps.yaml" || die "CANDIDATE_OWNER_INVALID"
  chmod 600 "$release_temporary/infra/vps.env" || die "CANDIDATE_ENV_MODE_INVALID"
  compose_mode="$(stat -c '%a' "$release_temporary/infra/compose.vps.yaml")" || die "CANDIDATE_COMPOSE_METADATA_INVALID"
  (( (8#$compose_mode & 0022) == 0 )) || die "CANDIDATE_COMPOSE_MODE_INVALID"
fi

"$DOCKER_BIN" compose -p "$PROJECT" --env-file "$release_temporary/infra/vps.env" -f "$release_temporary/infra/compose.vps.yaml" config --quiet || die "COMPOSE_INVALID"
"$DOCKER_BIN" compose -p "$PROJECT" --env-file "$release_temporary/infra/vps.env" -f "$release_temporary/infra/compose.vps.yaml" build web || die "WEB_BUILD_FAILED"
image_tag="hub-turismo-amazonas:$package_version"
image_id="$("$DOCKER_BIN" image inspect --format '{{.Id}}' "$image_tag")" || die "IMAGE_ID_UNREADABLE"
[[ -n "$image_id" ]] || die "IMAGE_ID_EMPTY"
compose_sha256="$(sha256sum "$release_temporary/infra/compose.vps.yaml" | awk '{print $1}')"
environment_sha256="$(grep -v '^[[:space:]]*APP_VERSION=' "$release_temporary/infra/vps.env" | sha256sum | awk '{print $1}')"
migrations_sha256="$(cd "$release_temporary" && find db/migrations db/postgres-migrations -type f -name '*.sql' -print0 | sort -z | xargs -0 sha256sum | sha256sum | awk '{print $1}')" || die "MIGRATION_FINGERPRINT_FAILED"

mkdir -p -m 700 -- "$ATTESTATION_ROOT"
attestation="$ATTESTATION_ROOT/candidate-$package_version.env"
attestation_temporary="$ATTESTATION_ROOT/.candidate-$package_version-${RANDOM}-${RANDOM}.tmp"
cleanup_paths+=("$attestation_temporary")
{
  printf 'CANDIDATE_PATH=%s\n' "$final_release"
  printf 'PACKAGE_VERSION=%s\n' "$package_version"
  printf 'GIT_HEAD=%s\n' "$git_head"
  printf 'GIT_TREE=%s\n' "$git_tree"
  printf 'ARCHIVE_SHA256=%s\n' "$archive_sha256"
  printf 'VERIFIER_SHA256=%s\n' "$verifier_sha256"
  printf 'IMAGE_TAG=%s\n' "$image_tag"
  printf 'IMAGE_ID=%s\n' "$image_id"
  printf 'COMPOSE_SHA256=%s\n' "$compose_sha256"
  printf 'ENVIRONMENT_SHA256=%s\n' "$environment_sha256"
  printf 'MIGRATIONS_SHA256=%s\n' "$migrations_sha256"
} > "$attestation_temporary"
chmod 600 "$attestation_temporary"
if [[ "$test_only" != true ]]; then chown hub:hub "$attestation_temporary" || die "ATTESTATION_OWNER_INVALID"; fi
mv -T -- "$release_temporary" "$final_release" || die "FINAL_RELEASE_PUBLICATION_FAILED"
cleanup_paths=("$attestation_temporary")
mv -T -- "$attestation_temporary" "$attestation" || die "ATTESTATION_PUBLICATION_FAILED"
cleanup_paths=()
attestation_sha256="$(sha256sum "$attestation" | awk '{print $1}')"
printf 'CANDIDATE_ATTESTATION=%s\n' "$attestation"
printf 'CANDIDATE_ATTESTATION_SHA256=%s\n' "$attestation_sha256"
