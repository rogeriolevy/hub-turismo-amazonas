import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const checker = resolve(
  fileURLToPath(new URL("../scripts/check-migration-immutability.mjs", import.meta.url)),
);
const baseResolver = resolve(
  fileURLToPath(new URL("../scripts/resolve-migration-base.mjs", import.meta.url)),
);

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

function writeMigration(
  repo: string,
  path: string,
  contents = "CREATE TABLE example (id INTEGER);\n",
) {
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

function resolveBase(repo: string, values: Record<string, string>) {
  return spawnSync(process.execPath, [baseResolver], {
    cwd: repo,
    encoding: "utf8",
    env: {
      ...process.env,
      PULL_REQUEST_BASE: "",
      PUSH_BEFORE: "",
      MANUAL_BASE: "",
      DEFAULT_BRANCH: "",
      ...values,
    },
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
    writeMigration(
      repo,
      "db/migrations/001_initial.sql",
      "ALTER TABLE example ADD COLUMN changed INTEGER;\n",
    );
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
    git(
      repo,
      "mv",
      "db/postgres-migrations/002_postgres.sql",
      "db/postgres-migrations/004_renamed.sql",
    );
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

test("a migration added at a divergent selected base cannot be removed from the run branch", () => {
  withRepository((repo, commonBase) => {
    git(repo, "checkout", "--quiet", "-b", "target");
    writeMigration(
      repo,
      "db/migrations/003_added_on_target.sql",
      "CREATE TABLE target_only (id INTEGER);\n",
    );
    git(repo, "add", "db/migrations/003_added_on_target.sql");
    git(repo, "commit", "-qm", "target adds migration");
    const selectedBase = git(repo, "rev-parse", "HEAD");

    git(repo, "checkout", "--quiet", "--detach", commonBase);

    const result = check(repo, selectedBase);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /db\/migrations\/003_added_on_target\.sql/);
  });
});

test("pull request base SHA takes priority over push and manual base inputs", () => {
  withRepository((repo, base) => {
    writeMigration(repo, "README.md", "pull request head\n");
    git(repo, "add", "README.md");
    git(repo, "commit", "-qm", "pull request head");
    const head = git(repo, "rev-parse", "HEAD");

    const result = resolveBase(repo, {
      PULL_REQUEST_BASE: base,
      PUSH_BEFORE: head,
      MANUAL_BASE: "HEAD",
      DEFAULT_BRANCH: "main",
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), base);
  });
});

test("ordinary push uses its nonzero before SHA before manual and default inputs", () => {
  withRepository((repo, base) => {
    writeMigration(repo, "README.md", "push head\n");
    git(repo, "add", "README.md");
    git(repo, "commit", "-qm", "push head");

    const result = resolveBase(repo, {
      PUSH_BEFORE: base,
      MANUAL_BASE: "HEAD",
      DEFAULT_BRANCH: "main",
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), base);
  });
});

test("a first push uses the fetched default branch instead of GitHub's all-zero before SHA", () => {
  withRepository((repo, base) => {
    writeMigration(repo, "README.md", "new branch commit\n");
    git(repo, "add", "README.md");
    git(repo, "commit", "-qm", "new branch commit");
    git(repo, "update-ref", "refs/remotes/origin/main", base);

    const result = resolveBase(repo, {
      PUSH_BEFORE: "0000000000000000000000000000000000000000",
      DEFAULT_BRANCH: "main",
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), base);
  });
});

test("manual migration-base branch names resolve through origin tracking refs", () => {
  withRepository((repo, base) => {
    writeMigration(repo, "README.md", "feature change\n");
    git(repo, "add", "README.md");
    git(repo, "commit", "-qm", "feature change");
    git(repo, "update-ref", "refs/remotes/origin/release/base", base);

    const result = resolveBase(repo, { MANUAL_BASE: "release/base" });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), base);
  });
});

test("manual migration base fails closed when it resolves to the selected run commit", () => {
  withRepository((repo) => {
    const result = resolveBase(repo, { MANUAL_BASE: "HEAD" });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /not earlier than the selected run commit/);
  });
});

test("manual migration base fails closed when it is a descendant of the selected run commit", () => {
  withRepository((repo) => {
    writeMigration(repo, "README.md", "later base commit\n");
    git(repo, "add", "README.md");
    git(repo, "commit", "-qm", "later base commit");
    const laterBase = git(repo, "rev-parse", "HEAD");
    git(repo, "checkout", "--quiet", "HEAD~1");

    const result = resolveBase(repo, { MANUAL_BASE: laterBase });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /not earlier than the selected run commit/);
  });
});

test("manual migration base fails closed when it has no common history with the run commit", () => {
  withRepository((repo, commonBase) => {
    git(repo, "checkout", "--quiet", "--orphan", "unrelated");
    git(repo, "rm", "-r", "--cached", "--quiet", ".");
    rmSync(join(repo, "db"), { recursive: true, force: true });
    rmSync(join(repo, "README.md"), { force: true });
    git(repo, "commit", "--allow-empty", "-qm", "unrelated root");
    const unrelatedBase = git(repo, "rev-parse", "HEAD");
    git(repo, "checkout", "--quiet", "--detach", commonBase);

    const result = resolveBase(repo, { MANUAL_BASE: unrelatedBase });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /no common history with the selected run commit/);
  });
});

test("an initial push without a fetched default branch can use HEAD as its baseline", () => {
  withRepository((repo, base) => {
    const result = resolveBase(repo, {
      PUSH_BEFORE: "0000000000000000000000000000000000000000",
      DEFAULT_BRANCH: "main",
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), git(repo, "rev-parse", "HEAD"));
  });
});

test("a missing base-ref argument fails closed with usage guidance", () => {
  withRepository((repo) => {
    const result = spawnSync(process.execPath, [checker], { cwd: repo, encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /provide a base revision with --base-ref <revision>/);
  });
});
