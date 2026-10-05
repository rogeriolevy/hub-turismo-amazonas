import { Pool } from "pg";
import { migratePostgresDatabase } from "../db/migrate-postgres.ts";

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString)
  throw new Error("Defina DATABASE_URL ou POSTGRES_URL para aplicar migrações PostgreSQL.");

const database = new Pool({
  connectionString,
  // One connection holds the advisory lock; another runs Better Auth migrations.
  max: 2,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
});

try {
  await migratePostgresDatabase(database);
  console.log("Esquema PostgreSQL e tabelas Better Auth atualizados.");
} finally {
  await database.end();
}
