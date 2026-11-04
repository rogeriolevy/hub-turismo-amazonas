import Database from "better-sqlite3";
import { resolve } from "node:path";
import { Pool, type PoolClient } from "pg";
import { readCatalogMediaManifest, sha256File } from "./catalog-media-manifest.ts";
import {
  readLocalMedia,
  readLocalMediaBytes,
  transformCatalogRows,
  validateStoredMediaRows,
  type SqliteRow,
} from "./sqlite-postgres-transfer-media.ts";

const tableOrder = [
  "user",
  "account",
  "contacts",
  "companies",
  "company_members",
  "rooms",
  "guides",
  "tours",
  "departures",
  "bookings",
  "user_notifications",
  "booking_reminders",
  "stay_records",
  "platform_audit",
  "cadastur_imports",
  "cadastur_entries",
  "catalog_items",
  "catalog_media",
] as const;
const transferableTables = new Set<string>(tableOrder);

const intentionallyExcludedTables = new Set([
  // Runtime/session state, signing material, throttling state and rebuildable caches.
  "schema_migrations",
  "session",
  "verification",
  "jwks",
  "rateLimit",
  "rate_limits",
  "nearby_place_cache",
  "osm_request_limits",
  // Delivery state should not replay old email after a database migration.
  "booking_email_outbox",
  // A heartbeat describes the old process and must be established by the new worker.
  "booking_email_worker_heartbeat",
]);
const optionalSourceTables = new Set(["user_notifications", "booking_reminders"]);

const batchSize = 100;
const legacyNullableColumns: Record<string, readonly string[]> = {
  // Backups created before migration 018 predate explicit guide/account linking.
  company_members: ["guide_id"],
};

type ColumnInfo = { name: string; data_type: string; udt_name: string };
type SQLiteDatabase = InstanceType<typeof Database>;

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function isApplyRequested() {
  return process.argv.includes("--apply");
}

function sourcePath() {
  const path = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
  if (!path) {
    throw new Error(
      "Uso: npm run db:transfer:postgres -- caminho/backup.sqlite [--apply] [--uploads=caminho]",
    );
  }
  return resolve(path);
}

function uploadDirectory() {
  const argument = process.argv.find((value) => value.startsWith("--uploads="));
  return resolve(argument?.slice("--uploads=".length) || "public/uploads/catalog");
}

async function forEachSourceBatch(
  source: SQLiteDatabase,
  table: string,
  callback: (rows: SqliteRow[]) => Promise<void>,
  size = batchSize,
) {
  const statement = source.prepare(`SELECT * FROM ${quoteIdentifier(table)}`);
  let batch: SqliteRow[] = [];
  let count = 0;
  for (const row of statement.iterate() as IterableIterator<SqliteRow>) {
    batch.push(row);
    count += 1;
    if (batch.length === size) {
      await callback(batch);
      batch = [];
    }
  }
  if (batch.length) await callback(batch);
  return count;
}

function sourceRowCount(source: SQLiteDatabase, table: string) {
  const result = source
    .prepare(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)}`)
    .get() as {
    count: number;
  };
  return result.count;
}

async function getTargetColumns(client: PoolClient, table: string) {
  const result = await client.query<ColumnInfo>(
    `SELECT column_name AS name, data_type, udt_name
       FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = $1
      ORDER BY ordinal_position`,
    [table],
  );
  if (!result.rows.length) throw new Error(`Tabela PostgreSQL ausente: ${table}`);
  return result.rows;
}

function convertValue(value: SqliteRow[string], column: ColumnInfo) {
  if (value === null) return null;
  if (column.data_type === "boolean") {
    if (value === 1 || value === BigInt(1) || value === "1") return true;
    if (value === 0 || value === BigInt(0) || value === "0") return false;
    throw new Error(`Valor booleano inesperado na coluna ${column.name}.`);
  }
  return value;
}

async function insertRows(
  client: PoolClient,
  table: string,
  columns: ColumnInfo[],
  rows: SqliteRow[],
) {
  if (!rows.length) return;
  const columnSql = columns.map((column) => quoteIdentifier(column.name)).join(",");
  const rowsPerBatch = table === "catalog_media" ? 1 : batchSize;
  for (let offset = 0; offset < rows.length; offset += rowsPerBatch) {
    const batch = rows.slice(offset, offset + rowsPerBatch);
    const values: unknown[] = [];
    const tuples = batch.map((row) => {
      const placeholders = columns.map((column) => {
        values.push(convertValue(row[column.name], column));
        return "$" + values.length;
      });
      return "(" + placeholders.join(",") + ")";
    });
    await client.query(
      `INSERT INTO ${quoteIdentifier(table)} (${columnSql}) VALUES ${tuples.join(",")} ON CONFLICT DO NOTHING`,
      values,
    );
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString)
    throw new Error("Configure DATABASE_URL no arquivo infra/vps.env antes da transferência.");

  const backupPath = sourcePath();
  const manifest = await readCatalogMediaManifest(`${backupPath}.media.json`);
  if (!manifest)
    throw new Error(
      `Manifesto do backup ausente: ${backupPath}.media.json. Gere um novo backup com npm run db:backup.`,
    );
  if ((await sha256File(backupPath)) !== manifest.databaseSha256)
    throw new Error("O arquivo SQLite não corresponde ao manifesto do backup.");

  const source = new Database(backupPath, { readonly: true, fileMustExist: true });
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 });
  let sourceTransactionStarted = false;
  try {
    source.exec("BEGIN DEFERRED");
    sourceTransactionStarted = true;
    if (source.pragma("integrity_check", { simple: true }) !== "ok")
      throw new Error("O arquivo SQLite não passou na verificação de integridade.");
    const foreignKeyViolations = (
      source.pragma("foreign_key_check") as { table: string; parent: string }[]
    ).filter(({ table }) => transferableTables.has(table));
    if (foreignKeyViolations.length) {
      const first = foreignKeyViolations[0];
      throw new Error(
        `O SQLite contém ${foreignKeyViolations.length} referências inválidas em tabelas transferidas; primeira ocorrência: ${first.table} → ${first.parent}.`,
      );
    }
    if (
      !source.prepare("SELECT 1 FROM schema_migrations WHERE name = ?").get("010_catalog_media.sql")
    ) {
      throw new Error("A origem SQLite precisa estar atualizada até a migração 010.");
    }

    const sourceNames = new Set(
      (
        source.prepare("SELECT name FROM sqlite_master WHERE type = ?").all("table") as {
          name: string;
        }[]
      ).map((row) => row.name),
    );
    for (const table of tableOrder) {
      if (!sourceNames.has(table) && !optionalSourceTables.has(table))
        throw new Error(`Tabela SQLite ausente: ${table}`);
    }
    for (const table of sourceNames) {
      if (
        !transferableTables.has(table) &&
        !intentionallyExcludedTables.has(table) &&
        !table.startsWith("sqlite_")
      ) {
        throw new Error(
          `Tabela SQLite sem regra de transferência: ${table}. Revise o importador antes de migrar os dados.`,
        );
      }
    }

    const mediaRows = source.prepare("SELECT name FROM catalog_media").all() as { name: string }[];
    const sourceMediaNames = new Set(mediaRows.map((row) => row.name));
    const { media: localMedia, names: allMediaNames } = await readLocalMedia(
      uploadDirectory(),
      sourceMediaNames,
      manifest,
    );
    const sourceCounts = new Map(
      tableOrder.map((table) => [
        table,
        sourceNames.has(table) ? sourceRowCount(source, table) : 0,
      ]),
    );

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        "hub-turismo-data-transfer",
      ]);

      const targetTables = await client.query<{ name: string }>(
        `SELECT table_name AS name
           FROM information_schema.tables
          WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'
          ORDER BY table_name`,
      );
      for (const { name } of targetTables.rows) {
        if (name === "schema_migrations") continue;
        const count = await client.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM ${quoteIdentifier(name)}`,
        );
        if (Number(count.rows[0].count) !== 0)
          throw new Error(`A tabela PostgreSQL ${name} já tem dados; transferência cancelada.`);
      }

      const columnsByTable = new Map<string, ColumnInfo[]>();
      const legacyDefaultsByTable = new Map<string, string[]>();
      for (const table of tableOrder) {
        const columns = await getTargetColumns(client, table);
        if (!sourceNames.has(table)) {
          columnsByTable.set(table, columns);
          legacyDefaultsByTable.set(table, []);
          continue;
        }
        const sourceColumns = source
          .prepare(`PRAGMA table_info(${quoteIdentifier(table)})`)
          .all() as { name: string }[];
        const sourceColumnNames = new Set(sourceColumns.map((column) => column.name));
        const targetColumnNames = new Set(columns.map((column) => column.name));
        const extraSourceColumns = sourceColumns.filter(
          (column) => !targetColumnNames.has(column.name),
        );
        const missingTargetColumns = columns.filter(
          (column) => !sourceColumnNames.has(column.name),
        );
        const allowedLegacyColumns = new Set(legacyNullableColumns[table] ?? []);
        if (
          extraSourceColumns.length ||
          missingTargetColumns.some((column) => !allowedLegacyColumns.has(column.name))
        ) {
          throw new Error(`Colunas SQLite e PostgreSQL diferem em ${table}; confira as migrações.`);
        }
        columnsByTable.set(table, columns);
        legacyDefaultsByTable.set(
          table,
          missingTargetColumns.map((column) => column.name),
        );
      }

      const expectedCounts = new Map<string, number>();
      for (const table of tableOrder) {
        expectedCounts.set(
          table,
          sourceCounts.get(table)! + (table === "catalog_media" ? localMedia.length : 0),
        );
      }

      if (!isApplyRequested()) {
        const catalogItemsRead = await forEachSourceBatch(source, "catalog_items", async (rows) => {
          transformCatalogRows(rows, allMediaNames);
        });
        if (catalogItemsRead !== sourceCounts.get("catalog_items"))
          throw new Error("A contagem dos itens do catálogo mudou durante a leitura da origem.");
        const storedMediaRead = await forEachSourceBatch(
          source,
          "catalog_media",
          async (rows) => {
            validateStoredMediaRows(rows);
          },
          1,
        );
        if (storedMediaRead !== sourceCounts.get("catalog_media"))
          throw new Error("A contagem das imagens do banco mudou durante a leitura da origem.");

        await client.query("ROLLBACK");
        for (const table of tableOrder)
          console.log(`${table}: ${expectedCounts.get(table)!} registros`);
        console.log(`Imagens locais adicionais: ${localMedia.length}`);
        console.log(
          "Prévia concluída; o PostgreSQL não foi alterado. Acrescente --apply para transferir.",
        );
        return;
      }

      for (const table of tableOrder) {
        if (!sourceNames.has(table)) continue;
        const columns = columnsByTable.get(table)!;
        const imported = await forEachSourceBatch(
          source,
          table,
          async (rows) => {
            const defaults = legacyDefaultsByTable.get(table) ?? [];
            const compatibleRows = defaults.length
              ? rows.map((row) => ({
                  ...row,
                  ...Object.fromEntries(defaults.map((name) => [name, null])),
                }))
              : rows;
            const preparedRows =
              table === "catalog_items"
                ? transformCatalogRows(compatibleRows, allMediaNames)
                : table === "catalog_media"
                  ? validateStoredMediaRows(compatibleRows)
                  : compatibleRows;
            await insertRows(client, table, columns, preparedRows);
          },
          table === "catalog_media" ? 1 : batchSize,
        );
        if (imported !== sourceCounts.get(table))
          throw new Error(`A contagem de ${table} mudou durante a leitura da origem.`);

        if (table === "catalog_media" && localMedia.length) {
          for (const media of localMedia) {
            const bytes = await readLocalMediaBytes(media);
            await insertRows(client, table, columns, [
              {
                name: media.name,
                content_type: media.contentType,
                content_base64: bytes.toString("base64"),
                created_at: media.createdAt,
              } as SqliteRow,
            ]);
          }
        }
      }

      for (const table of tableOrder) {
        const result = await client.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM ${quoteIdentifier(table)}`,
        );
        if (Number(result.rows[0].count) !== expectedCounts.get(table))
          throw new Error(
            `A contagem final de ${table} difere da origem; transferência cancelada.`,
          );
      }
      await client.query("COMMIT");
      for (const table of tableOrder)
        console.log(`${table}: ${expectedCounts.get(table)} registros transferidos`);
      console.log(`Imagens locais transferidas: ${localMedia.length}`);
      console.log("Contagens confirmadas. Sessões e dados temporários não foram transferidos.");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } finally {
    if (sourceTransactionStarted) source.exec("ROLLBACK");
    source.close();
    await pool.end();
  }
}

await main();
