import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const backupScript = resolve(repositoryRoot, "infra/backup-postgres.sh");
const restoreScript = resolve(repositoryRoot, "infra/restore-postgres.sh");
const activeBackupScript = resolve(repositoryRoot, "infra/backup-postgres-active.sh");
const gitBash = process.env.GIT_BASH_EXE ?? "C:/Program Files/Git/bin/bash.exe";
const cygpath = process.env.CYGPATH_EXE ?? "C:/Program Files/Git/usr/bin/cygpath.exe";

function toPosixPath(windowsPath: string) {
  const result = spawnSync(cygpath, ["-u", windowsPath], { encoding: "utf8", windowsHide: true });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function createActiveBackupFixture() {
  const root = mkdtempSync(join(tmpdir(), "hub-active-backup-"));
  const release = join(root, "release-0.12.16");
  const fakeBin = join(root, "fake-bin");
  const backupDirectory = join(root, "backups");
  mkdirSync(join(release, "infra"), { recursive: true, mode: 0o700 });
  mkdirSync(join(release, "scripts"), { recursive: true, mode: 0o700 });
  mkdirSync(fakeBin, { recursive: true, mode: 0o700 });
  mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
  writeFileSync(join(root, ".hub-backup-fixture"), "hub-backup-test-fixture-v1\n", { mode: 0o600 });
  writeFileSync(join(release, "infra", "backup-postgres.sh"), "#!/usr/bin/env bash\n", { mode: 0o500 });
  writeFileSync(join(release, "infra", "vps.env"), "APP_VERSION=0.12.16\n", { mode: 0o600 });
  writeFileSync(join(release, "scripts", "capture-postgres-backup-source.mjs"), "// fixture marker\n", { mode: 0o500 });
  symlinkSync(release, join(root, "current"), process.platform === "win32" ? "junction" : "dir");
  const sourceRecord = '{"schema":"hub-postgres-source-v1","capturedAtUtc":"2026-01-02T03:04:05.006Z","counts":{"accounts":"1","bookings":"2"},"ledgerSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","releaseVersion":"0.12.16"}';
  writeFileSync(
    join(fakeBin, "docker"),
    `#!/usr/bin/env bash
set -Eeuo pipefail
printf '%s\\n' "$*" >> "$FIXTURE_ROOT/docker-calls.log"
if [[ "$1" == ps ]]; then
  [[ "$*" == *service=postgres* ]] && { printf 'postgres-fixture\\n'; exit 0; }
  [[ "$*" == *service=web* ]] && { printf 'web-fixture\\n'; exit 0; }
  exit 41
fi
if [[ "$1" == inspect ]]; then
  [[ "$*" == *.State.Status* ]] && { printf 'running\\n'; exit 0; }
  [[ "$*" == *.State.Health* ]] && { printf 'healthy\\n'; exit 0; }
  exit 42
fi
if [[ "$1" == exec ]]; then
  if [[ "$*" == *web-fixture*capture-postgres-backup-source.mjs* ]]; then
    printf 'SNAPSHOT_ID=A1-2\\nSOURCE_RECORD=${sourceRecord}\\nSOURCE_ROLE=postgres\\n'
    IFS= read -r completion
    [[ "$completion" == COMPLETE ]] || exit 43
    exit 0
  fi
  if [[ "$*" == *'test "$POSTGRES_USER"'* ]]; then
    [[ "\${FAKE_ROLE_MISMATCH:-}" != true ]] || exit 44
    exit 0
  fi
  if [[ "$*" == *pg_dump* ]]; then
    [[ "\${FAKE_DUMP_FAILURE:-}" != true ]] || exit 45
    printf 'PGDMP-fixture-archive\\n'
    exit 0
  fi
  if [[ "$*" == *pg_restore* ]]; then cat >/dev/null; exit 0; fi
fi
exit 46
`,
    { mode: 0o700 },
  );
  return { root, backupDirectory, fakeBin };
}

function runActiveBackupFixture(fixture: ReturnType<typeof createActiveBackupFixture>, failure = "") {
  return spawnSync(gitBash, [activeBackupScript], {
    encoding: "utf8",
    windowsHide: true,
    env: {
      ...process.env,
      PATH: `${toPosixPath(fixture.fakeBin)}:${process.env.PATH ?? ""}`,
      FIXTURE_ROOT: toPosixPath(fixture.root),
      HUB_BACKUP_TEST_MODE: "true",
      HUB_INSTALL_ROOT: toPosixPath(fixture.root),
      BACKUP_DIRECTORY: toPosixPath(fixture.backupDirectory),
      BACKUP_RETENTION_DAYS: "14",
      FAKE_DUMP_FAILURE: failure === "dump" ? "true" : "",
      FAKE_ROLE_MISMATCH: failure === "role" ? "true" : "",
    },
  });
}

test("source snapshot receipt contract is present", () => {
  const activeBackup = readFileSync(activeBackupScript, "utf8");
  assert.ok(activeBackup.includes("SOURCE_RECEIPT_FILE="), "source receipt marker is missing");
  assert.ok(activeBackup.includes("pg_dump --snapshot="), "pg_dump snapshot option is missing");
});

test("same exported snapshot is used by the active backup wrapper", () => {
  const fixture = createActiveBackupFixture();
  try {
    const result = runActiveBackupFixture(fixture);
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /SOURCE_RECEIPT_FILE=/);
    assert.match(
      readFileSync(join(fixture.root, "docker-calls.log"), "utf8"),
      /pg_dump --snapshot="\$1".* sh A1-2/,
    );
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("atomic backup receipt publishes all four receipt files", () => {
  const activeBackup = readFileSync(activeBackupScript, "utf8");
  assert.ok(activeBackup.includes("source_receipt_file"), "receipt file publication is missing");
  assert.ok(activeBackup.includes("source_receipt_checksum_file"), "receipt sidecar publication is missing");
});

test("backup receipt failure cleans owned partial files", () => {
  const fixture = createActiveBackupFixture();
  try {
    const result = runActiveBackupFixture(fixture, "dump");
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /PG_DUMP_FAILED/);
    assert.deepEqual(readdirSync(fixture.backupDirectory), []);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test(
  "PostgreSQL backup retention and restore scripts fail safely",
  { skip: process.platform === "win32" ? "requires POSIX bash" : false },
  () => {
    const testRoot = mkdtempSync(join(tmpdir(), "hub-postgres-backup-"));
    const mockBin = join(testRoot, "bin");
    const backupDirectory = join(testRoot, "backups");
    const envFile = join(testRoot, "vps.env");
    const databaseState = join(testRoot, "databases");
    const failedRestoreOutput = join(testRoot, "failed-restore.log");
    const mockDocker = join(mockBin, "docker");

    try {
      mkdirSync(mockBin, { mode: 0o700 });
      mkdirSync(backupDirectory, { mode: 0o700 });
      writeFileSync(envFile, "POSTGRES_DB=hub_backup_test\n");
      writeFileSync(databaseState, "");
      writeFileSync(
        mockDocker,
        `#!/usr/bin/env bash
set -Eeuo pipefail
case "$*" in
  *pg_dump*)
    printf 'PGDMP-mock-archive\\n'
    ;;
  *pg_restore*--list*)
    archive="$(cat)"
    [[ "$archive" == PGDMP* ]] || exit 21
    ;;
  *createdb*)
    target=''
    for arg in "$@"; do target="$arg"; done
    [[ "$target" != mock_existing ]] || exit 22
    printf '%s\\n' "$target" >> "$MOCK_DB_STATE"
    ;;
  *dropdb*)
    target=''
    for arg in "$@"; do target="$arg"; done
    grep -vxF "$target" "$MOCK_DB_STATE" > "$MOCK_DB_STATE.tmp" || true
    mv "$MOCK_DB_STATE.tmp" "$MOCK_DB_STATE"
    ;;
  *pg_restore*)
    archive="$(cat)"
    [[ "$MOCK_RESTORE_FAIL" != 1 ]] || exit 23
    [[ "$archive" == PGDMP* ]] || exit 24
    ;;
  *)
    echo "Unexpected mocked docker invocation: $*" >&2
    exit 90
    ;;
esac
`,
      );
      chmodSync(mockDocker, 0o700);

      const oldDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
      const expiredBackup = join(backupDirectory, "hub-expired.dump");
      const unrelatedDump = join(backupDirectory, "unrelated.dump");
      const baseEnvironment = {
        ...process.env,
        PATH: `${mockBin}${delimiter}${process.env.PATH ?? ""}`,
        HUB_ENV_FILE: envFile,
        BACKUP_DIRECTORY: backupDirectory,
        BACKUP_RETENTION_DAYS: "14",
        MOCK_DB_STATE: databaseState,
        MOCK_RESTORE_FAIL: "0",
      };

      writeFileSync(expiredBackup, "old");
      writeFileSync(unrelatedDump, "keep");
      utimesSync(expiredBackup, oldDate, oldDate);
      utimesSync(unrelatedDump, oldDate, oldDate);

      const backup = spawnSync("bash", [backupScript], {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: baseEnvironment,
      });
      assert.equal(backup.status, 0, backup.stderr);
      const backupMatch = /^Backup PostgreSQL criado: (.+)$/m.exec(backup.stdout);
      assert.ok(backupMatch, "backup archive path is reported");
      const backupPath = backupMatch[1];
      assert.ok(backupPath.endsWith(".dump"));
      assert.ok(existsSync(backupPath), "backup archive is written");
      assert.ok(!existsSync(expiredBackup), "expired application backups are removed");
      assert.ok(existsSync(unrelatedDump), "unrelated files are retained");

      const invalidRetention = spawnSync("bash", [backupScript], {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: { ...baseEnvironment, BACKUP_RETENTION_DAYS: "99999" },
      });
      assert.notEqual(invalidRetention.status, 0);
      assert.match(invalidRetention.stderr, /BACKUP_RETENTION_DAYS/);

      const overwrite = spawnSync("bash", [restoreScript, backupPath, "mock_existing"], {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: baseEnvironment,
      });
      assert.notEqual(overwrite.status, 0, "existing database names are refused");
      assert.equal(readFileSync(databaseState, "utf8"), "");

      const restore = spawnSync("bash", [restoreScript, backupPath, "mock_restored"], {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: baseEnvironment,
      });
      assert.equal(restore.status, 0, restore.stderr);
      assert.match(restore.stdout, /Restauração concluída/);
      assert.match(readFileSync(databaseState, "utf8"), /^mock_restored\n$/);

      const failedRestore = spawnSync("bash", [restoreScript, backupPath, "mock_partial"], {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: { ...baseEnvironment, MOCK_RESTORE_FAIL: "1" },
      });
      writeFileSync(failedRestoreOutput, `${failedRestore.stdout}${failedRestore.stderr}`);
      assert.notEqual(failedRestore.status, 0, "restore errors are returned");
      assert.match(
        readFileSync(failedRestoreOutput, "utf8"),
        /banco parcial recém-criado foi removido/,
      );
      assert.doesNotMatch(readFileSync(databaseState, "utf8"), /mock_partial/);

      const corruptBackup = join(testRoot, "corrupt.dump");
      writeFileSync(corruptBackup, "not-a-postgres-archive\n");
      const corruptRestore = spawnSync("bash", [restoreScript, corruptBackup, "mock_invalid"], {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: baseEnvironment,
      });
      assert.notEqual(corruptRestore.status, 0, "invalid archives fail before database creation");
      assert.doesNotMatch(readFileSync(databaseState, "utf8"), /mock_invalid/);
    } finally {
      rmSync(testRoot, { recursive: true, force: true });
    }
  },
);
