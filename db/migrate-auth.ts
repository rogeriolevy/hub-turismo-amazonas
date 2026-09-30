import type Database from "better-sqlite3";
import { getMigrations } from "better-auth/db/migration";
import { authOptions } from "../server/auth-config.ts";
import { migrateContacts } from "./migrate.ts";

export async function migrateDatabase(db: Database.Database) {
  migrateContacts(db);
  const migrations = await getMigrations(authOptions(db));
  await migrations.runMigrations();
}
