import { createHash } from "node:crypto";
import { Client } from "pg";

const snapshotPattern = /^[A-F0-9]+-[0-9]+$/i;
const countPattern = /^(0|[1-9][0-9]*)$/;

function fail(message) {
  process.stderr.write(`SOURCE_CAPTURE_ERROR=${message}\n`);
  process.exitCode = 1;
}

function quoteIdentifier(identifier) {
  if (typeof identifier !== "string" || identifier.length === 0 || identifier.includes("\0")) {
    throw new Error("invalid table identifier");
  }
  return `"${identifier.replaceAll('"', '""')}"`;
}

function releaseVersion() {
  const value = process.env.APP_VERSION;
  if (typeof value !== "string" || !/^\d+\.\d+\.\d+$/.test(value)) {
    throw new Error("APP_VERSION is required and must be semver");
  }
  return value;
}

async function waitForCompletion() {
  process.stdin.setEncoding("utf8");
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  if (input !== "COMPLETE\n") throw new Error("completion handshake is invalid");
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (typeof connectionString !== "string" || connectionString.length === 0) {
    throw new Error("DATABASE_URL is required");
  }

  const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });
  let transactionOpen = false;
  try {
    await client.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    transactionOpen = true;

    const snapshotResult = await client.query("SELECT pg_export_snapshot() AS snapshot_id, current_user AS role");
    const snapshotId = snapshotResult.rows[0]?.snapshot_id;
    const sourceRole = snapshotResult.rows[0]?.role;
    if (typeof snapshotId !== "string" || !snapshotPattern.test(snapshotId)) {
      throw new Error("PostgreSQL returned an invalid exported snapshot id");
    }
    if (typeof sourceRole !== "string" || !/^[A-Za-z_][A-Za-z0-9_$-]*$/.test(sourceRole)) {
      throw new Error("PostgreSQL returned an invalid source role");
    }

    const tablesResult = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> 'schema_migrations' ORDER BY table_name",
    );
    const counts = {};
    for (const row of tablesResult.rows) {
      const tableName = row.table_name;
      const countResult = await client.query(`SELECT count(*)::text AS count FROM public.${quoteIdentifier(tableName)}`);
      const count = countResult.rows[0]?.count;
      if (typeof count !== "string" || !countPattern.test(count)) {
        throw new Error(`invalid aggregate count for ${tableName}`);
      }
      counts[tableName] = count;
    }

    const ledgerResult = await client.query("SELECT name, checksum FROM schema_migrations ORDER BY name");
    const ledger = ledgerResult.rows.map(({ name, checksum }) => ({ name, checksum }));
    const sourceRecord = {
      schema: "hub-postgres-source-v1",
      capturedAtUtc: new Date().toISOString(),
      counts,
      ledgerSha256: createHash("sha256").update(JSON.stringify(ledger)).digest("hex"),
      releaseVersion: releaseVersion(),
    };

    process.stdout.write(`SNAPSHOT_ID=${snapshotId}\n`);
    process.stdout.write(`SOURCE_RECORD=${JSON.stringify(sourceRecord)}\n`);
    process.stdout.write(`SOURCE_ROLE=${sourceRole}\n`);
    await waitForCompletion();
    await client.query("COMMIT");
    transactionOpen = false;
  } finally {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => fail(error instanceof Error ? error.message : "unknown source capture failure"));
