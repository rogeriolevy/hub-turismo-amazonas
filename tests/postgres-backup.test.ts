import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
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
