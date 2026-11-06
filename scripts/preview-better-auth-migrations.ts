import { getMigrations } from "better-auth/db/migration";
import { Pool } from "pg";
import { authOptions } from "../server/auth-config.ts";

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) throw new Error("DATABASE_URL ou POSTGRES_URL é necessário.");

const pool = new Pool({
  connectionString,
  max: 2,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 10_000,
});

try {
  const migrationPlan = await getMigrations(authOptions(pool, true, false, true), {
    throwOnUnsafe: false,
  });
  const compiled = await migrationPlan.compileMigrations();
  const report = {
    tablesToCreate: migrationPlan.toBeCreated.map(({ table }) => table),
    tablesWithColumnsToAdd: migrationPlan.toBeAdded.map(({ table, fields }) => ({
      table,
      columns: Object.keys(fields).sort(),
    })),
    indexesToAdd: migrationPlan.toBeAddedIndexes.map(({ table, name }) => ({ table, name })),
    schemaProblems: migrationPlan.schemaProblems,
    unsafeChanges: migrationPlan.unsafeChanges,
    compiledMigrationSqlPresent: compiled.trim() !== ";",
  };
  console.log(JSON.stringify(report));
  const hasChanges =
    report.tablesToCreate.length > 0 ||
    report.tablesWithColumnsToAdd.length > 0 ||
    report.indexesToAdd.length > 0 ||
    report.schemaProblems.length > 0 ||
    report.unsafeChanges.length > 0 ||
    report.compiledMigrationSqlPresent;
  if (hasChanges) process.exitCode = 2;
  else console.log("BETTER_AUTH_MIGRATION_PREVIEW=empty");
} finally {
  await pool.end();
}
