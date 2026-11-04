import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) throw new Error("DATABASE_URL ou POSTGRES_URL é necessário.");

const sharedDirectory = fileURLToPath(new URL("../db/migrations/", import.meta.url));
const postgresDirectory = fileURLToPath(new URL("../db/postgres-migrations/", import.meta.url));

async function getExpectedMigrations(directory: string, prefix = "") {
  const names = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  const result = new Map<string, string>();
  for (const name of names) {
    const source = (await readFile(directory + name, "utf8")).replace(/\r\n/g, "\n");
    result.set(prefix + name, createHash("sha256").update(source).digest("hex"));
  }
  return result;
}

const expected = await getExpectedMigrations(sharedDirectory);
for (const [name, checksum] of await getExpectedMigrations(postgresDirectory, "postgres/")) {
  expected.set(name, checksum);
}

const pool = new Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 10_000,
});

try {
  const result = await pool.query<{ name: string; checksum: string }>(
    "SELECT name, checksum FROM schema_migrations ORDER BY name",
  );
  const actual = new Map(result.rows.map(({ name, checksum }) => [name, checksum]));
  const missing = [...expected.keys()].filter((name) => !actual.has(name)).sort();
  const extra = [...actual.keys()].filter((name) => !expected.has(name)).sort();
  const mismatched = [...expected]
    .filter(([name, checksum]) => actual.has(name) && actual.get(name) !== checksum)
    .map(([name]) => name)
    .sort();
  const report = {
    expectedCount: expected.size,
    actualCount: actual.size,
    missing,
    extra,
    mismatched,
  };
  console.log(JSON.stringify(report));
  if (missing.length || extra.length || mismatched.length) process.exitCode = 2;
  else console.log("POSTGRES_MIGRATION_LEDGER=match");
} finally {
  await pool.end();
}
