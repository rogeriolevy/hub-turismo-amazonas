import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const [sourceArgument, backupArgument, ...extraArguments] = process.argv.slice(2);

if (!sourceArgument || !backupArgument || extraArguments.length > 0) {
  console.error("Uso: node scripts/compare-sqlite-snapshots.mjs ORIGEM.sqlite BACKUP.sqlite");
  process.exit(2);
}

const sourcePath = resolve(sourceArgument);
const backupPath = resolve(backupArgument);

if (sourcePath === backupPath) {
  console.error("Informe dois arquivos diferentes para comparar.");
  process.exit(2);
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function encodeValue(value) {
  if (value === null) return ["null"];
  if (Buffer.isBuffer(value)) return ["blob", value.toString("base64")];
  if (typeof value === "bigint") return ["integer", value.toString()];
  if (typeof value === "number") return ["real", Object.is(value, -0) ? "-0" : value.toString()];
  if (typeof value === "string") return ["text", value];
  throw new Error("A base contém um valor SQLite não suportado para comparação segura.");
}

function snapshot(path) {
  const db = new Database(path, { readonly: true, fileMustExist: true });

  try {
    db.defaultSafeIntegers(true);
    const integrity = db.pragma("integrity_check", { simple: true });
    const foreignKeyViolations = db.pragma("foreign_key_check").length;
    const schemaObjects = db
      .prepare(
        `SELECT type,name,tbl_name,sql
           FROM sqlite_master
          WHERE type IN ('table','index','trigger','view')
            AND (name NOT LIKE 'sqlite_%' OR name='sqlite_sequence')
          ORDER BY type,name`,
      )
      .all();
    const tableNames = schemaObjects
      .filter((object) => object.type === "table")
      .map((object) => object.name);
    const tableHashes = {};
    let totalRows = 0n;

    for (const name of tableNames) {
      const quotedName = quoteIdentifier(name);
      const columns = db.pragma(`table_info(${quotedName})`);
      const primaryKey = columns
        .filter((column) => column.pk > 0)
        .sort((left, right) => Number(left.pk - right.pk))
        .map((column) => quoteIdentifier(column.name));
      const orderBy = primaryKey.length ? primaryKey.join(",") : "rowid";
      const selectedColumns = columns.map((column) => quoteIdentifier(column.name)).join(",");
      const hash = createHash("sha256");
      hash.update(
        JSON.stringify(
          columns.map(({ name: columnName, type, notnull, dflt_value, pk }) => ({
            name: columnName,
            type,
            notnull: Number(notnull),
            dflt_value,
            pk: Number(pk),
          })),
        ),
      );
      let rowCount = 0n;

      for (const row of db
        .prepare(`SELECT ${selectedColumns} FROM ${quotedName} ORDER BY ${orderBy}`)
        .iterate()) {
        hash.update(JSON.stringify(columns.map((column) => encodeValue(row[column.name]))));
        hash.update("\n");
        rowCount += 1n;
      }

      hash.update(`rows:${rowCount}`);
      totalRows += rowCount;
      tableHashes[name] = hash.digest("hex");
    }

    const schemaHash = createHash("sha256").update(JSON.stringify(schemaObjects)).digest("hex");
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ schemaHash, tableHashes }))
      .digest("hex");

    return { integrity, foreignKeyViolations, tableHashes, schemaHash, fingerprint, totalRows };
  } finally {
    db.close();
  }
}

let source;
let backup;

try {
  source = snapshot(sourcePath);
  backup = snapshot(backupPath);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Falha ao comparar snapshots SQLite: ${message}`);
  process.exit(1);
}

const tableNames = [
  ...new Set([...Object.keys(source.tableHashes), ...Object.keys(backup.tableHashes)]),
].sort();
const mismatches = tableNames.filter(
  (name) => source.tableHashes[name] !== backup.tableHashes[name],
);

if (source.integrity !== "ok" || backup.integrity !== "ok") {
  console.error("Uma das bases não passou em integrity_check.");
  process.exitCode = 1;
} else if (source.foreignKeyViolations || backup.foreignKeyViolations) {
  console.error("Uma das bases contém violações de chaves estrangeiras.");
  process.exitCode = 1;
} else if (source.schemaHash !== backup.schemaHash || mismatches.length > 0) {
  console.error(`As bases diferem no esquema ou em ${mismatches.length} tabela(s):`);
  for (const name of mismatches) console.error(`- ${name}`);
  if (source.schemaHash !== backup.schemaHash) console.error("- esquema SQLite");
  process.exitCode = 1;
} else {
  console.log(
    `Snapshots SQLite equivalentes: ${tableNames.length} tabelas, ${source.totalRows} linhas. SHA-256 ${source.fingerprint}`,
  );
}
