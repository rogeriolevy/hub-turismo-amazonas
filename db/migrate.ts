import type Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function migrateContacts(db: Database.Database) {
  const directory = fileURLToPath(new URL("./migrations/", import.meta.url));
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)",
  );
  for (const name of readdirSync(directory)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    const sql = readFileSync(directory + name, "utf8").replace(/\r\n/g, "\n");
    const checksum = createHash("sha256").update(sql).digest("hex");
    // SQLite table rebuilds must run with FK enforcement paused outside the transaction.
    // Check all relations before committing, then restore the connection's original setting.
    const rebuild = name === "005_public_directory.sql";
    const foreignKeys = db.pragma("foreign_keys", { simple: true });
    if (rebuild) db.pragma("foreign_keys = OFF");
    try {
      db.transaction(() => {
        const applied = db
          .prepare("SELECT checksum FROM schema_migrations WHERE name = ?")
          .get(name) as { checksum: string } | undefined;
        if (applied) {
          if (applied.checksum !== checksum)
            throw new Error("A migração " + name + " foi alterada após aplicação.");
          return;
        }
        db.exec(sql);
        if (rebuild && (db.pragma("foreign_key_check") as unknown[]).length)
          throw new Error("A migração deixou vínculos inválidos; nenhuma alteração foi aplicada.");
        db.prepare("INSERT INTO schema_migrations VALUES (?, ?, ?)").run(
          name,
          checksum,
          new Date().toISOString(),
        );
      })();
    } finally {
      if (rebuild) db.pragma("foreign_keys = " + (foreignKeys ? "ON" : "OFF"));
    }
  }
}
