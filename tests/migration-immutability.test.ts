import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const checker = resolve(fileURLToPath(new URL("../scripts/check-migration-immutability.mjs", import.meta.url)));

function withRepository(run: (repo: string, base: string) => void) {
  const repo = mkdtempSync(join(tmpdir(), "migration-immutability-"));
  try {
    execFileSync("git", ["init", "-q", repo]);
    git(repo, "config", "user.name", "Migration Test");
    git(repo, "config", "user.email", "migration-test@example.invalid");
    writeMigration(repo, "db/migrations/001_initial.sql");
    writeMigration(repo, "db/postgres-migrations/002_postgres.sql");
    git(repo, "add", "db");
    git(repo, "commit", "-qm", "baseline");
    const base = git(repo, "rev-parse", "HEAD");
    run(repo, base);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

function writeMigration(repo: string, path: string, contents = "CREATE TABLE example (id INTEGER);\n") {
  const absolute = join(repo, path);
  mkdirSync(join(absolute, ".."), { recursive: true });
  writeFileSync(absolute, contents);
}

function git(repo: string, ...args: string[]) {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
}

function check(repo: string, base: string) {
  return spawnSync(process.execPath, [checker, "--base-ref", base], {
    cwd: repo,
    encoding: "utf8",
  });
}

test("unchanged shared and PostgreSQL-only baseline passes", () => {
  withRepository((repo, base) => {
    const result = check(repo, base);
    assert.equal(result.status, 0, result.stderr);
  });
});

test("editing an existing migration fails and names its path", () => {
  withRepository((repo, base) => {
    writeMigration(repo, "db/migrations/001_initial.sql", "ALTER TABLE example ADD COLUMN changed INTEGER;\n");
    const result = check(repo, base);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /db\/migrations\/001_initial\.sql/);
  });
});

test("new numbered migrations in both migration roots are allowed", () => {
  withRepository((repo, base) => {
    writeMigration(repo, "db/migrations/003_additive.sql");
    writeMigration(repo, "db/postgres-migrations/004_pg_additive.sql");
    git(repo, "add", "db");
    const result = check(repo, base);
    assert.equal(result.status, 0, result.stderr);
  });
});

test("deleting baseline migrations from both roots fails with each path", () => {
  withRepository((repo, base) => {
    rmSync(join(repo, "db/migrations/001_initial.sql"));
    rmSync(join(repo, "db/postgres-migrations/002_postgres.sql"));
    const result = check(repo, base);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /db\/migrations\/001_initial\.sql/);
    assert.match(result.stderr, /db\/postgres-migrations\/002_postgres\.sql/);
  });
});

test("renaming baseline migrations in both roots fails with the original paths", () => {
  withRepository((repo, base) => {
    git(repo, "mv", "db/migrations/001_initial.sql", "db/migrations/003_renamed.sql");
    git(repo, "mv", "db/postgres-migrations/002_postgres.sql", "db/postgres-migrations/004_renamed.sql");
    const result = check(repo, base);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /db\/migrations\/001_initial\.sql/);
    assert.match(result.stderr, /db\/postgres-migrations\/002_postgres\.sql/);
  });
});

test("an invalid base revision fails closed with an actionable diagnostic", () => {
  withRepository((repo) => {
    const result = check(repo, "missing-base-revision");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /base revision 'missing-base-revision' cannot be resolved/);
  });
});

test("a missing base-ref argument fails closed with usage guidance", () => {
  withRepository((repo) => {
    const result = spawnSync(process.execPath, [checker], { cwd: repo, encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /provide a base revision with --base-ref <revision>/);
  });
});
