import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const activationScript = path.join(repositoryRoot, "infra", "activate-vps-release.sh");
const gitBash = process.env.GIT_BASH_EXE ?? "C:/Program Files/Git/bin/bash.exe";
const cygpath = process.env.CYGPATH_EXE ?? "C:/Program Files/Git/usr/bin/cygpath.exe";
const fixtureDirectories: string[] = [];

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

const fakeDocker = `#!/usr/bin/env bash
# hub-activation-fake-runtime-v1
set -euo pipefail
printf 'docker' >> "$FIXTURE_ROOT/calls.log"
for argument in "$@"; do printf '|%s' "$argument" >> "$FIXTURE_ROOT/calls.log"; done
printf '\\n' >> "$FIXTURE_ROOT/calls.log"

active_release() { readlink -f "$FIXTURE_ROOT/current"; }
version_from_release() { awk -F '"' '/^[[:space:]]*"version"[[:space:]]*:/ { print $4; exit }' "$1/package.json"; }
active_version() { version_from_release "$(active_release)"; }

if [[ "$1" == "info" ]]; then exit 0; fi
if [[ "$1" == "compose" ]]; then
  shift
  release=""
  action=""
  config_option=""
  service=""
  while (($#)); do
    case "$1" in
      --env-file) shift 2 ;;
      -f) compose_file="$2"; release="$(dirname "$(dirname "$compose_file")")"; shift 2 ;;
      config|ps|up) action="$1"; shift; break ;;
      *) shift ;;
    esac
  done
  if [[ "$action" == "config" ]]; then
    for argument in "$@"; do config_option="$argument"; done
    case "$config_option" in
      --quiet) exit 0 ;;
      --services)
        printf 'postgres\\nweb\\nbooking-email-worker\\n'
        if [[ "\${HUB_GUARD_SCENARIO:-}" == compose-service-drift && "$(version_from_release "$release")" == 0.12.14 ]]; then printf 'proxy\\n'; fi
        exit 0
        ;;
      --images)
        version="$(version_from_release "$release")"
        if [[ "\${HUB_GUARD_SCENARIO:-}" == image-mismatch && "$version" == 0.12.14 ]]; then printf 'unexpected-image\\n'; exit 0; fi
        printf 'hub-turismo-amazonas:%s\\nhub-turismo-amazonas:%s\\npostgres:18.6-alpine\\n' "$version" "$version"
        exit 0
        ;;
    esac
  fi
  if [[ "$action" == "ps" ]]; then
    service="\${@: -1}"
    case "$service" in
      postgres)
        if [[ "\${HUB_GUARD_SCENARIO:-}" == postgres-id-drift && "$(active_version)" == 0.12.14 ]]; then printf 'pg-fixture-candidate\\n'; else printf 'pg-fixture\\n'; fi
        ;;
      web) printf 'web-%s\\n' "$(version_from_release "$release")" ;;
      booking-email-worker) printf 'worker-%s\\n' "$(version_from_release "$release")" ;;
      *) exit 31 ;;
    esac
    exit 0
  fi
  if [[ "$action" == "up" ]]; then
    expected_services='web booking-email-worker'
    actual_services="$(printf '%s ' "$@" | sed -E 's/.*--no-build //')"
    actual_services="$(xargs <<<"$actual_services")"
    [[ "$actual_services" == "$expected_services" ]] || exit 32
    version="$(version_from_release "$release")"
    printf 'up|%s|%s\\n' "$version" "$actual_services" >> "$FIXTURE_ROOT/calls.log"
    if [[ "\${HUB_GUARD_SCENARIO:-}" == health-fail-rollback-fail && "$version" == 0.12.13 ]]; then exit 45; fi
    exit 0
  fi
fi

if [[ "$1" == "image" && "$2" == "inspect" ]]; then
  printf 'sha256:0000000000000000000000000000000000000000000000000000000000000001\\n'
  exit 0
fi

if [[ "$1" == "inspect" ]]; then
  format="$3"
  case "$format" in
    *State.Health*)
      inspected="\${@: -1}"
      if [[ "$inspected" == pg-fixture* && ( "\${HUB_GUARD_SCENARIO:-}" == postgres-unhealthy || ( "\${HUB_GUARD_SCENARIO:-}" == postgres-unhealthy-candidate && "$(active_version)" == 0.12.14 ) ) ]]; then printf 'unhealthy\\n'; else printf 'healthy\\n'; fi
      ;;
    *Config.Image*)
      if [[ "\${HUB_GUARD_SCENARIO:-}" == postgres-image-drift && "$(active_version)" == 0.12.14 ]]; then printf 'postgres:18.7-alpine\\n'; else printf 'postgres:18.6-alpine\\n'; fi
      ;;
    *Mounts*)
      if [[ "\${HUB_GUARD_SCENARIO:-}" == postgres-volume-drift && "$(active_version)" == 0.12.14 ]]; then printf 'hub-fixture-postgres-data-changed\\n'; else printf 'hub-fixture-postgres-data\\n'; fi
      ;;
    *) exit 33 ;;
  esac
  exit 0
fi

if [[ "$1" == "exec" ]]; then
  command_line="$*"
  if [[ "$command_line" == *verify-postgres-migration-ledger.ts* ]]; then
    scenario="\${HUB_GUARD_SCENARIO:-}"
    active="$(active_version)"
    if [[ "$scenario" == ledger-missing || ( "$scenario" == post-ledger-missing && "$active" == 0.12.14 ) ]]; then
      printf '{"expectedCount":1,"actualCount":1,"missing":["x.sql"],"extra":[],"mismatched":[]}\\n'
      exit 2
    fi
    if [[ "$scenario" == ledger-extra || ( "$scenario" == post-ledger-extra && "$active" == 0.12.14 ) ]]; then
      printf '{"expectedCount":1,"actualCount":1,"missing":[],"extra":["x.sql"],"mismatched":[]}\\n'
      exit 2
    fi
    if [[ "$scenario" == ledger-mismatch || ( "$scenario" == post-ledger-mismatch && "$active" == 0.12.14 ) ]]; then
      printf '{"expectedCount":1,"actualCount":1,"missing":[],"extra":[],"mismatched":["x.sql"]}\\n'
      exit 2
    fi
    printf '{"expectedCount":1,"actualCount":1,"missing":[],"extra":[],"mismatched":[]}\\nPOSTGRES_MIGRATION_LEDGER=match\\n'
    exit 0
  fi
  if [[ "$command_line" == *verify-vps-health.mjs* ]]; then exit 0; fi
  if [[ "$command_line" == *check-booking-worker-health.ts* ]]; then
    if [[ "\${HUB_GUARD_SCENARIO:-}" == worker-fail-candidate && "$(active_version)" == 0.12.14 ]]; then exit 1; fi
    printf 'booking_email_worker_health_check_ok\\n'
    exit 0
  fi
  if [[ "$command_line" == *'--input-type=module -'* ]]; then
    count=7
    if [[ "\${HUB_GUARD_SCENARIO:-}" == post-counts-drift && "$(active_version)" == 0.12.14 ]]; then count=8; fi
    ledger_hash=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
    if [[ "\${HUB_GUARD_SCENARIO:-}" == post-ledger-hash-drift && "$(active_version)" == 0.12.14 ]]; then ledger_hash=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb; fi
    printf 'DB_COUNTS={"accounts":"%s"}\\nLEDGER_SHA256=%s\\n' "$count" "$ledger_hash"
    exit 0
  fi
fi

printf 'unexpected fake docker command\\n' >&2
exit 34
`;

const fakeCurl = `#!/usr/bin/env bash
# hub-activation-fake-runtime-v1
set -euo pipefail
printf 'curl' >> "$FIXTURE_ROOT/calls.log"
for argument in "$@"; do printf '|%s' "$argument" >> "$FIXTURE_ROOT/calls.log"; done
printf '\\n' >> "$FIXTURE_ROOT/calls.log"
version="$(awk -F '"' '/^[[:space:]]*"version"[[:space:]]*:/ { print $4; exit }' "$(readlink -f "$FIXTURE_ROOT/current")/package.json")"
url="\${@: -1}"
status=ok
if [[ ( "\${HUB_GUARD_SCENARIO:-}" == health-fail-candidate || "\${HUB_GUARD_SCENARIO:-}" == health-fail-rollback-fail ) && "$version" == 0.12.14 ]]; then status=degraded; fi
database=postgresql
if [[ "\${HUB_GUARD_SCENARIO:-}" == database-not-postgres-candidate && "$version" == 0.12.14 ]]; then database=sqlite; fi
if [[ "\${HUB_GUARD_SCENARIO:-}" == version-mismatch-candidate && "$version" == 0.12.14 ]]; then version=0.12.13; fi
printf '{"status":"%s","version":"%s","database":"%s"}\\n' "$status" "$version" "$database"
if [[ "$url" == https://* ]]; then
  if [[ "\${HUB_GUARD_SCENARIO:-}" == public-status-fail-candidate && "$version" == 0.12.14 ]]; then printf '503\\n'; else printf '200\\n'; fi
fi
`;

const fixtureSetCurrent = `param(
  [Parameter(Mandatory = $true)][string]$FixtureRoot,
  [Parameter(Mandatory = $true)][string]$Current,
  [Parameter(Mandatory = $true)][string]$Target
)
$ErrorActionPreference = 'Stop'
# hub-activation-fake-runtime-v1
$root = [System.IO.Path]::GetFullPath($FixtureRoot).TrimEnd('\\') + '\\'
$currentPath = [System.IO.Path]::GetFullPath($Current)
$targetPath = [System.IO.Path]::GetFullPath($Target)
if (!(Test-Path -LiteralPath (Join-Path $FixtureRoot '.hub-activation-fixture'))) { throw 'fixture sentinel missing' }
if (!(Get-Content -LiteralPath (Join-Path $FixtureRoot '.hub-activation-fixture') -Raw).Contains('hub-activation-test-fixture-v1')) { throw 'fixture sentinel invalid' }
if (!$currentPath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'current outside fixture' }
if (!$targetPath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'target outside fixture' }
$currentItem = Get-Item -LiteralPath $Current -Force
if (($currentItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -eq 0) { throw 'current is not a junction' }
[System.IO.Directory]::Delete($currentPath, $false)
New-Item -ItemType Junction -Path $currentPath -Target $targetPath | Out-Null
`;

function commandOutput(file: string, args: string[]): string {
  const result = spawnSync(file, args, { encoding: "utf8", windowsHide: true });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr || `Command exited ${result.status}`);
  return result.stdout.trim();
}

function toPosixPath(windowsPath: string): string {
  return commandOutput(cygpath, ["-u", windowsPath]);
}

function bashOutput(script: string): string {
  return commandOutput(gitBash, ["-lc", script]);
}

async function createFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "hub-vps-activation-"));
  fixtureDirectories.push(root);
  const posixRoot = toPosixPath(root);
  const candidate = path.join(root, "release-candidate");
  const previous = path.join(root, "release-previous");
  const fakeBin = path.join(root, "fake-bin");
  await mkdir(fakeBin, { recursive: true });
  await writeFile(path.join(root, ".hub-activation-fixture"), "hub-activation-test-fixture-v1\n");
  await writeFile(path.join(fakeBin, ".hub-fake-runtime"), "hub-activation-fake-runtime-v1\n");
  await writeFile(path.join(fakeBin, "docker"), fakeDocker);
  await writeFile(path.join(fakeBin, "curl"), fakeCurl);
  await writeFile(path.join(fakeBin, "set-current.ps1"), fixtureSetCurrent);
  await chmod(path.join(fakeBin, "docker"), 0o755);
  await chmod(path.join(fakeBin, "curl"), 0o755);

  const compose =
    "name: hub-turismo\nservices:\n  postgres:\n    image: postgres:18.6-alpine\n  web:\n    image: hub-turismo-amazonas:${APP_VERSION}\n  booking-email-worker:\n    image: hub-turismo-amazonas:${APP_VERSION}\n";
  for (const [release, version] of [
    [candidate, "0.12.14"],
    [previous, "0.12.13"],
  ] as const) {
    await mkdir(path.join(release, "infra"), { recursive: true });
    await mkdir(path.join(release, "db", "migrations"), { recursive: true });
    await mkdir(path.join(release, "db", "postgres-migrations"), { recursive: true });
    await writeFile(
      path.join(release, "package.json"),
      JSON.stringify({ name: "hub-turismo-amazonas", version }, null, 2) + "\n",
    );
    await writeFile(path.join(release, "infra", "compose.vps.yaml"), compose);
    await writeFile(
      path.join(release, "infra", "vps.env"),
      `APP_VERSION=${version}\nSITE_URL=https://fixture.invalid\n`,
    );
    await writeFile(path.join(release, "db", "migrations", "001-fixture.sql"), "SELECT 1;\n");
    await writeFile(
      path.join(release, "db", "postgres-migrations", "002-fixture.sql"),
      "SELECT 2;\n",
    );
  }
  const attestations = path.join(root, "attestations");
  await mkdir(attestations, { recursive: true });
  const candidatePath = toPosixPath(candidate);
  const posixCandidate = toPosixPath(candidate);
  const candidateComposeHash = bashOutput(
    `sha256sum -- '${posixCandidate}/infra/compose.vps.yaml' | awk '{print $1}'`,
  );
  const candidateEnvironmentHash = bashOutput(
    `grep -v '^[[:space:]]*APP_VERSION=' '${posixCandidate}/infra/vps.env' | sha256sum | awk '{print $1}'`,
  );
  const candidateMigrationsHash = bashOutput(
    `cd '${posixCandidate}' && find db/migrations db/postgres-migrations -type f -name '*.sql' -print0 | sort -z | xargs -0 sha256sum | sha256sum | awk '{print $1}'`,
  );
  const candidateAttestation = path.join(attestations, "candidate-0.12.14.env");
  const candidateContents = [
    `CANDIDATE_PATH=${candidatePath}`,
    "PACKAGE_VERSION=0.12.14",
    `GIT_HEAD=${"a".repeat(40)}`,
    `GIT_TREE=${"b".repeat(40)}`,
    `ARCHIVE_SHA256=${"c".repeat(64)}`,
    `VERIFIER_SHA256=${"d".repeat(64)}`,
    "IMAGE_TAG=hub-turismo-amazonas:0.12.14",
    `IMAGE_ID=sha256:${"0".repeat(63)}1`,
    `COMPOSE_SHA256=${candidateComposeHash}`,
    `ENVIRONMENT_SHA256=${candidateEnvironmentHash}`,
    `MIGRATIONS_SHA256=${candidateMigrationsHash}`,
    "",
  ].join("\n");
  await writeFile(candidateAttestation, candidateContents);
  await chmod(candidateAttestation, 0o600);
  const candidateAttestationSha256 = sha256(candidateContents);
  const backupAttestation = path.join(attestations, "backup-fixture.env");
  const backupContents = [
    `CANDIDATE_ATTESTATION_PATH=${toPosixPath(candidateAttestation)}`,
    `CANDIDATE_ATTESTATION_SHA256=${candidateAttestationSha256}`,
    "CANDIDATE_VERSION=0.12.14",
    `CANDIDATE_IMAGE_ID=sha256:${"0".repeat(63)}1`,
    "DUMP_FILE=fixture.dump",
    `DUMP_SHA256=${"e".repeat(64)}`,
    "SOURCE_RECEIPT_FILE=fixture.source.json",
    `SOURCE_RECEIPT_SHA256=${"f".repeat(64)}`,
    'SOURCE_COUNTS={"accounts":"7"}',
    `SOURCE_LEDGER_SHA256=${"a".repeat(64)}`,
    "RESTORE_SOURCE_COMPARISON=match",
    "RESTORE_DATABASE_CLEANUP=ok",
    "REMOTE_STAGING_CLEANUP=ok",
    "ISSUED_AT_UTC=2026-11-05T00:00:00.0000000Z",
    "EXPIRES_AT_UTC=2099-11-05T01:00:00.0000000Z",
    "",
  ].join("\n");
  await writeFile(backupAttestation, backupContents);
  await chmod(backupAttestation, 0o600);
  await symlink(
    previous,
    path.join(root, "current"),
    process.platform === "win32" ? "junction" : "dir",
  );
  return {
    root,
    posixRoot,
    candidate,
    previous,
    fakeBin,
    posixFakeBin: toPosixPath(fakeBin),
    candidateAttestation,
    posixCandidateAttestation: toPosixPath(candidateAttestation),
    candidateAttestationSha256,
    backupAttestation,
    posixBackupAttestation: toPosixPath(backupAttestation),
    backupAttestationSha256: sha256(backupContents),
  };
}

function runGuard(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  options: {
    simulate?: boolean;
    scenario?: string;
    extraArgs?: string[];
    withAttestations?: boolean;
    candidateAttestationSha256?: string;
    backupAttestationSha256?: string;
  } = {},
) {
  const args = [
    activationScript,
    "--test-only",
    "--fixture-root",
    fixture.posixRoot,
    "--fake-bin",
    fixture.posixFakeBin,
    ...(options.withAttestations === false
      ? []
      : [
          "--candidate-attestation",
          fixture.posixCandidateAttestation,
          "--candidate-attestation-sha256",
          options.candidateAttestationSha256 ?? fixture.candidateAttestationSha256,
          "--backup-attestation",
          fixture.posixBackupAttestation,
          "--backup-attestation-sha256",
          options.backupAttestationSha256 ?? fixture.backupAttestationSha256,
        ]),
    ...(options.simulate ? ["--simulate-activate"] : []),
    ...(options.extraArgs ?? []),
  ];
  return spawnSync(gitBash, args, {
    encoding: "utf8",
    windowsHide: true,
    env: {
      ...process.env,
      TMPDIR: "/tmp",
      FIXTURE_ROOT: fixture.posixRoot,
      HUB_GUARD_SCENARIO: options.scenario ?? "",
    },
  });
}

async function currentTarget(fixture: Awaited<ReturnType<typeof createFixture>>) {
  return realpath(path.join(fixture.root, "current"));
}

async function callLog(fixture: Awaited<ReturnType<typeof createFixture>>) {
  return readFile(path.join(fixture.root, "calls.log"), "utf8").catch(() => "");
}

test("test-only preflight checks compatibility without changing current or starting Compose", async () => {
  const fixture = await createFixture();
  const result = runGuard(fixture);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PREFLIGHT=passed/);
  assert.match(result.stdout, /CURRENT_UNCHANGED=ok/);
  assert.equal(await currentTarget(fixture), await realpath(fixture.previous));
  assert.doesNotMatch(await callLog(fixture), /\|up\|/);
  assert.match(await callLog(fixture), /^docker\|/m);
});

test("preflight requires independently hashed candidate and backup attestations before runtime inspection", async () => {
  const fixture = await createFixture();
  const result = runGuard(fixture, { simulate: true, withAttestations: false });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ERROR=CANDIDATE_ATTESTATION_REQUIRED/);
  assert.equal(await currentTarget(fixture), await realpath(fixture.previous));
  assert.equal(await callLog(fixture), "");
});

for (const [name, receipt, expectedError] of [
  ["malformed candidate", "INVALID=x\n", "CANDIDATE_ATTESTATION_UNKNOWN_KEY"],
  [
    "candidate version mismatch",
    "PACKAGE_VERSION=0.12.99",
    "CANDIDATE_ATTESTATION_VERSION_MISMATCH",
  ],
] as const) {
  test(`${name} receipt fails before runtime inspection or a pointer switch`, async () => {
    const fixture = await createFixture();
    const original = await readFile(fixture.candidateAttestation, "utf8");
    const changed = original.replace(/^PACKAGE_VERSION=.*$/m, receipt.trim());
    await writeFile(fixture.candidateAttestation, changed);
    const result = runGuard(fixture, {
      simulate: true,
      candidateAttestationSha256: sha256(changed),
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, new RegExp(`ERROR=${expectedError}`));
    assert.equal(await currentTarget(fixture), await realpath(fixture.previous));
    assert.equal(await callLog(fixture), "");
  });
}

for (const [name, field, invalidValue, expectedError] of [
  ["candidate image id", "IMAGE_ID", "sha256:not-a-digest", "CANDIDATE_ATTESTATION_IMAGE_ID_INVALID"],
  ["candidate Compose hash", "COMPOSE_SHA256", "not-a-hash", "CANDIDATE_ATTESTATION_COMPOSE_HASH_INVALID"],
  ["candidate environment hash", "ENVIRONMENT_SHA256", "not-a-hash", "CANDIDATE_ATTESTATION_ENVIRONMENT_HASH_INVALID"],
  ["candidate migrations hash", "MIGRATIONS_SHA256", "not-a-hash", "CANDIDATE_ATTESTATION_MIGRATIONS_HASH_INVALID"],
  ["candidate Git head", "GIT_HEAD", "not-a-pin", "CANDIDATE_ATTESTATION_GIT_HEAD_INVALID"],
  ["candidate Git tree", "GIT_TREE", "not-a-pin", "CANDIDATE_ATTESTATION_GIT_TREE_INVALID"],
] as const) {
  test(`${name} syntax fails before Docker or Compose inspection`, async () => {
    const fixture = await createFixture();
    const original = await readFile(fixture.candidateAttestation, "utf8");
    const changed = original.replace(new RegExp(`^${field}=.*$`, "m"), `${field}=${invalidValue}`);
    await writeFile(fixture.candidateAttestation, changed);
    const result = runGuard(fixture, {
      simulate: true,
      candidateAttestationSha256: sha256(changed),
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, new RegExp(`ERROR=${expectedError}`));
    assert.equal(await currentTarget(fixture), await realpath(fixture.previous));
    assert.equal(await callLog(fixture), "");
  });
}

for (const [name, transform, expectedError] of [
  [
    "expired backup",
    (contents: string) => contents.replace("2099-11-05T01:00:00.0000000Z", "2000-11-05T01:00:00.0000000Z"),
    "BACKUP_ATTESTATION_EXPIRED",
  ],
  [
    "backup candidate binding mismatch",
    (contents: string) => contents.replace(/^CANDIDATE_ATTESTATION_SHA256=.*$/m, `CANDIDATE_ATTESTATION_SHA256=${"0".repeat(64)}`),
    "BACKUP_ATTESTATION_CANDIDATE_BINDING_MISMATCH",
  ],
] as const) {
  test(`${name} receipt fails before runtime inspection or a pointer switch`, async () => {
    const fixture = await createFixture();
    const original = await readFile(fixture.backupAttestation, "utf8");
    const changed = transform(original);
    await writeFile(fixture.backupAttestation, changed);
    const result = runGuard(fixture, {
      simulate: true,
      backupAttestationSha256: sha256(changed),
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, new RegExp(`ERROR=${expectedError}`));
    assert.equal(await currentTarget(fixture), await realpath(fixture.previous));
    assert.equal(await callLog(fixture), "");
  });
}

test("test-only simulated activation switches only the fixture and only web/worker", async () => {
  const fixture = await createFixture();
  const result = runGuard(fixture, { simulate: true });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /ACTIVATION=passed/);
  assert.equal(await currentTarget(fixture), await realpath(fixture.candidate));
  assert.match(await callLog(fixture), /up\|[^\n]+\|web booking-email-worker/);
  const upCalls = (await callLog(fixture)).split("\n").filter((line) => line.startsWith("up|"));
  assert.equal(upCalls.length, 1);
  assert.match(upCalls[0], /^up\|[^|]+\|web booking-email-worker$/);
});

for (const scenario of ["ledger-missing", "ledger-extra", "ledger-mismatch"]) {
  test(`ledger ${scenario} fails closed before changing current or starting Compose`, async () => {
    const fixture = await createFixture();
    const result = runGuard(fixture, { simulate: true, scenario });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ERROR=MIGRATION_LEDGER_MISMATCH/);
    assert.equal(await currentTarget(fixture), await realpath(fixture.previous));
    assert.doesNotMatch(await callLog(fixture), /\|up\|/);
  });
}

for (const [scenario, errorCode] of [
  ["compose-service-drift", "COMPOSE_SERVICE_SET_INVALID"],
  ["image-mismatch", "COMPOSE_APP_IMAGE_MISMATCH"],
  ["postgres-unhealthy", "POSTGRES_NOT_HEALTHY"],
] as const) {
  test(`${scenario} is rejected during preflight without switching or Compose up`, async () => {
    const fixture = await createFixture();
    const result = runGuard(fixture, { simulate: true, scenario });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, new RegExp(`ERROR=${errorCode}`));
    assert.equal(await currentTarget(fixture), await realpath(fixture.previous));
    assert.doesNotMatch(await callLog(fixture), /\|up\|/);
  });
}

test("migration checksum drift fails before switching or invoking Compose up", async () => {
  const fixture = await createFixture();
  await writeFile(
    path.join(fixture.candidate, "db", "migrations", "001-fixture.sql"),
    "SELECT 999;\n",
  );
  const result = runGuard(fixture, { simulate: true });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ERROR=MIGRATION_SET_OR_CHECKSUM_DRIFT/);
  assert.equal(await currentTarget(fixture), await realpath(fixture.previous));
  assert.doesNotMatch(await callLog(fixture), /\|up\|/);
});

for (const change of ["added", "removed"] as const) {
  test(`migration ${change} fails before switching or invoking Compose up`, async () => {
    const fixture = await createFixture();
    const migrationPath = path.join(fixture.candidate, "db", "migrations", "001-fixture.sql");
    if (change === "added") {
      await writeFile(
        path.join(fixture.candidate, "db", "migrations", "003-extra.sql"),
        "SELECT 3;\n",
      );
    } else {
      await rm(migrationPath);
    }
    const result = runGuard(fixture, { simulate: true });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ERROR=MIGRATION_SET_OR_CHECKSUM_DRIFT/);
    assert.equal(await currentTarget(fixture), await realpath(fixture.previous));
    assert.doesNotMatch(await callLog(fixture), /\|up\|/);
  });
}

test("environment or Compose content drift fails before switching or invoking Compose up", async () => {
  const fixture = await createFixture();
  await writeFile(
    path.join(fixture.candidate, "infra", "vps.env"),
    "APP_VERSION=0.12.14\nSITE_URL=https://other.invalid\n",
  );
  const envResult = runGuard(fixture, { simulate: true });
  assert.notEqual(envResult.status, 0);
  assert.match(envResult.stderr, /ERROR=ENVIRONMENT_CONTENT_DRIFT/);
  assert.equal(await currentTarget(fixture), await realpath(fixture.previous));
  assert.doesNotMatch(await callLog(fixture), /\|up\|/);

  const composeFixture = await createFixture();
  await writeFile(
    path.join(composeFixture.candidate, "infra", "compose.vps.yaml"),
    "name: changed\nservices: {}\n",
  );
  const composeResult = runGuard(composeFixture, { simulate: true });
  assert.notEqual(composeResult.status, 0);
  assert.match(composeResult.stderr, /ERROR=COMPOSE_FILE_DRIFT/);
  assert.equal(await currentTarget(composeFixture), await realpath(composeFixture.previous));
  assert.doesNotMatch(await callLog(composeFixture), /\|up\|/);
});

for (const scenario of [
  "health-fail-candidate",
  "worker-fail-candidate",
  "post-ledger-missing",
  "post-ledger-extra",
  "post-ledger-mismatch",
  "postgres-unhealthy-candidate",
  "postgres-id-drift",
  "postgres-image-drift",
  "postgres-volume-drift",
  "post-counts-drift",
  "post-ledger-hash-drift",
  "database-not-postgres-candidate",
  "version-mismatch-candidate",
  "public-status-fail-candidate",
]) {
  test(`${scenario} rolls current back and restarts only web and worker`, async () => {
    const fixture = await createFixture();
    const result = runGuard(fixture, { simulate: true, scenario });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ROLLBACK=passed/);
    assert.equal(await currentTarget(fixture), await realpath(fixture.previous));
    const upCalls = (await callLog(fixture)).split("\n").filter((line) => line.startsWith("up|"));
    assert.equal(upCalls.length, 2);
    assert.ok(upCalls.every((line) => line.endsWith("|web booking-email-worker")));
  });
}

test("canonical public HTTPS failure rolls back only web and worker", async () => {
  const fixture = await createFixture();
  const result = runGuard(fixture, { simulate: true, scenario: "public-status-fail-candidate" });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ERROR=PUBLIC_HEALTH_STATUS_INVALID/);
  assert.match(result.stderr, /ROLLBACK=passed/);
  assert.equal(await currentTarget(fixture), await realpath(fixture.previous));
  const upCalls = (await callLog(fixture)).split("\n").filter((line) => line.startsWith("up|"));
  assert.equal(upCalls.length, 2);
  assert.ok(upCalls.every((line) => line.endsWith("|web booking-email-worker")));
});

test("rollback failure returns the distinct terminal code 90", async () => {
  const fixture = await createFixture();
  const result = runGuard(fixture, { simulate: true, scenario: "health-fail-rollback-fail" });

  assert.equal(result.status, 90);
  assert.match(result.stderr, /ACTIVATION=failed/);
  assert.match(result.stderr, /ROLLBACK=failed/);
  assert.match(result.stderr, /ORIGINAL_EXIT=1/);
  assert.equal(await currentTarget(fixture), await realpath(fixture.previous));
  const upCalls = (await callLog(fixture)).split("\n").filter((line) => line.startsWith("up|"));
  assert.equal(upCalls.length, 2);
  assert.ok(upCalls.every((line) => line.endsWith("|web booking-email-worker")));
});

test("test mode rejects production flags and roots under the production release path", async () => {
  const fixture = await createFixture();
  const productionFlags = runGuard(fixture, {
    extraArgs: ["--candidate", fixture.posixRoot, "--previous", fixture.posixRoot, "--activate"],
  });
  assert.notEqual(productionFlags.status, 0);
  assert.match(productionFlags.stderr, /PRODUCTION_FLAGS_FORBIDDEN_IN_TEST_MODE/);

  const productionRoot = spawnSync(
    gitBash,
    [
      activationScript,
      "--test-only",
      "--fixture-root",
      "/opt/hub-turismo/release-fixture",
      "--fake-bin",
      "/opt/hub-turismo/fake-bin",
    ],
    {
      encoding: "utf8",
      windowsHide: true,
      env: { ...process.env, TMPDIR: "/tmp" },
    },
  );
  assert.notEqual(productionRoot.status, 0);
  assert.match(productionRoot.stderr, /PRODUCTION_PATH_FORBIDDEN_IN_TEST_MODE/);
  const currentInfo = await lstat(path.join(fixture.root, "current"));
  assert.equal(currentInfo.isSymbolicLink() || currentInfo.isDirectory(), true);
});

after(async () => {
  await Promise.all(
    fixtureDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});
