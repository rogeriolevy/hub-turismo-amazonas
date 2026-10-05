import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getMigrations } from "better-auth/db/migration";
import type { Pool } from "pg";
import { authOptions } from "../server/auth-config.ts";

export async function migratePostgresDatabase(pool: Pool) {
  // Keep the session advisory lock on one dedicated connection. The CLI pool
  // reserves a second connection for Better Auth's migration planner/runner.
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('hub-turismo-schema-migrations'))");
    const authMigrations = await getMigrations(authOptions(pool, true, false, true));
    await authMigrations.runMigrations();

    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)",
    );
    const directory = fileURLToPath(new URL("./migrations/", import.meta.url));
    const names = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();

    for (const name of names) {
      const sourceSql = (await readFile(directory + name, "utf8")).replace(/\r\n/g, "\n");
      const checksum = createHash("sha256").update(sourceSql).digest("hex");
      // Keep the shared migration's original checksum for existing SQLite installations,
      // while quoting PostgreSQL's reserved WINDOW identifier during PG execution.
      const sql =
        name === "001_contacts.sql" ? sourceSql.replace(/\bwindow\b/gi, '"window"') : sourceSql;
      try {
        await client.query("BEGIN");
        const applied = await client.query<{ checksum: string }>(
          "SELECT checksum FROM schema_migrations WHERE name=$1",
          [name],
        );
        const existing = applied.rows[0];
        if (existing) {
          if (existing.checksum !== checksum)
            throw new Error("A migração " + name + " foi alterada após aplicação.");
          await client.query("COMMIT");
          continue;
        }
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (name,checksum,applied_at) VALUES ($1,$2,$3)",
          [name, checksum, new Date().toISOString()],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      }
    }
  } finally {
    await client
      .query("SELECT pg_advisory_unlock(hashtext('hub-turismo-schema-migrations'))")
      .catch(() => undefined);
    client.release();
  }
}
