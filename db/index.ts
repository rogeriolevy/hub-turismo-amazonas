import Database from "better-sqlite3";
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Pool, type PoolClient } from "pg";

export function openDatabase(filename = process.env.DATABASE_PATH || "data/hub.sqlite") {
  if (filename !== ":memory:")
    mkdirSync(dirname(resolve(filename)), { recursive: true, mode: 0o700 });
  const db = new Database(filename);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  return db;
}

export type DatabaseHandle = Database.Database | Pool;
export type DatabaseExecutor = Database.Database | Pool | PoolClient;

const sqliteTransaction = new AsyncLocalStorage<Database.Database>();
const sqliteQueues = new WeakMap<Database.Database, Promise<void>>();
let database: DatabaseHandle | undefined;

function connectionString() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

export function isPostgresExecutor(db: DatabaseExecutor): db is Pool | PoolClient {
  return "query" in db && typeof db.query === "function";
}

export function lockSuffix(db: DatabaseExecutor, tables?: string) {
  if (!isPostgresExecutor(db)) return "";
  return " FOR UPDATE" + (tables ? " OF " + tables : "");
}

export async function lockKey(db: DatabaseExecutor, key: string) {
  if (isPostgresExecutor(db)) await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [key]);
}

export function isPostgresDatabase(db: DatabaseHandle): db is Pool {
  return db instanceof Pool;
}

export function getDatabase(): DatabaseHandle {
  if (database) return database;
  const url = connectionString();
  if (url) {
    database = new Pool({
      connectionString: url,
      max: process.env.VERCEL ? 1 : 10,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      allowExitOnIdle: !process.env.VERCEL,
    });
    return database;
  }
  if (process.env.VERCEL)
    throw new Error("Configure DATABASE_URL (ou POSTGRES_URL) no ambiente da Vercel.");
  database = openDatabase();
  return database;
}

export function openManagementDatabase(): DatabaseHandle {
  const url = connectionString();
  if (!url) return openDatabase();
  return new Pool({
    connectionString: url,
    max: 2,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    allowExitOnIdle: !process.env.VERCEL,
  });
}

async function withSqliteLock<T>(db: Database.Database, action: () => T | Promise<T>) {
  if (sqliteTransaction.getStore() === db) return action();
  const previous = sqliteQueues.get(db) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => (release = resolve));
  const tail = previous.then(() => current);
  sqliteQueues.set(db, tail);
  await previous;
  try {
    return await action();
  } finally {
    release();
    if (sqliteQueues.get(db) === tail) sqliteQueues.delete(db);
  }
}

function postgresSql(sql: string) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

export async function one<T>(db: DatabaseExecutor, sql: string, ...values: unknown[]) {
  if (isPostgresExecutor(db)) {
    const result = await db.query(postgresSql(sql), values);
    return result.rows[0] as T | undefined;
  }
  return withSqliteLock(db, () => db.prepare(sql).get(...values) as T | undefined);
}

export async function many<T>(db: DatabaseExecutor, sql: string, ...values: unknown[]) {
  if (isPostgresExecutor(db)) {
    const result = await db.query(postgresSql(sql), values);
    return result.rows as T[];
  }
  return withSqliteLock(db, () => db.prepare(sql).all(...values) as T[]);
}

export async function run(db: DatabaseExecutor, sql: string, ...values: unknown[]) {
  if (isPostgresExecutor(db)) {
    const result = await db.query(postgresSql(sql), values);
    return { changes: result.rowCount ?? 0, rows: result.rows };
  }
  return withSqliteLock(db, () => db.prepare(sql).run(...values));
}

export async function write<T>(
  db: DatabaseExecutor,
  action: (transaction: DatabaseExecutor) => T | Promise<T>,
) {
  try {
    if (isPostgresExecutor(db)) {
      const client = db instanceof Pool ? await db.connect() : db;
      const ownsClient = client !== db;
      try {
        await client.query("BEGIN");
        const result = await action(client);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        if (ownsClient) client.release();
      }
    }
    return await withSqliteLock(db, async () => {
      if (sqliteTransaction.getStore() === db)
        throw new Error("Transações SQLite aninhadas não são suportadas.");
      db.exec("BEGIN IMMEDIATE");
      try {
        const result = await sqliteTransaction.run(db, () => action(db));
        db.exec("COMMIT");
        return result;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      ["SQLITE_CONSTRAINT_UNIQUE", "23505"].includes(String(error.code))
    ) {
      const { HttpError } = await import("../server/http.ts");
      throw new HttpError(
        409,
        "DUPLICATE",
        "Este identificador já está cadastrado. Escolha outro.",
      );
    }
    throw error;
  }
}
