import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function openDatabase(filename = process.env.DATABASE_PATH || "data/hub.sqlite") {
  if (filename !== ":memory:")
    mkdirSync(dirname(resolve(filename)), { recursive: true, mode: 0o700 });
  const db = new Database(filename);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  return db;
}
let database: Database.Database | undefined;
export function getDatabase() {
  return (database ??= openDatabase());
}
