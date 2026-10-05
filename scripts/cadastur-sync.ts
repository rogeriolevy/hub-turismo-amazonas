import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { isPostgresDatabase, openDatabase, openManagementDatabase } from "../db/index.ts";
import { migratePostgresDatabase } from "../db/migrate-postgres.ts";
import { migrateDatabase } from "../db/migrate-auth.ts";
import { directoryCategories } from "../server/cadastur/public-directory.ts";
import { listResources, downloadResource } from "../server/cadastur/sources.ts";
import { parseCadasturFile } from "../server/cadastur/files.ts";
import { createPreview, commitImport, reviewEntry } from "../server/cadastur/service.ts";
import { normalizeLabel } from "../lib/cadastur-schema.ts";
import { requirePlatformAdmin } from "../server/platform-access.ts";
import { many, one } from "../server/platform-store.ts";
import type { Actor } from "../server/platform-models.ts";

const apply = process.argv.includes("--apply"),
  publish = process.argv.includes("--publish");
if (!apply)
  throw new Error(
    "Use --apply para importar o Amazonas. Acrescente --publish para exibir os registros importados no diretório público.",
  );
const db = openManagementDatabase();
const postgres = isPostgresDatabase(db);
try {
  if (!postgres && !existsSync(process.env.DATABASE_PATH || "data/hub.sqlite"))
    throw new Error("Banco existente não encontrado. Execute a configuração inicial primeiro.");
  if (postgres) {
    await migratePostgresDatabase(db);
    console.log("Usando PostgreSQL configurado. Confirme que há um backup do provedor.");
  } else {
    mkdirSync("backups", { recursive: true });
    const destination = resolve(
      "backups/cadastur-" + new Date().toISOString().replace(/[:.]/g, "-") + ".sqlite",
    );
    await db.backup(destination);
    const saved = openDatabase(destination);
    try {
      if (saved.pragma("integrity_check", { simple: true }) !== "ok")
        throw new Error("Falha na verificação do backup.");
    } finally {
      saved.close();
    }
    console.log("Backup verificado: " + destination);
    await migrateDatabase(db);
  }
  const email = (process.env.ADMIN_EMAILS || "").split(",")[0].trim().toLowerCase();
  const actor = await one<Actor>(
    db,
    'SELECT id,email,name FROM "user" WHERE lower(email)=?',
    email,
  );
  if (!actor) throw new Error("Administrador configurado não encontrado.");
  requirePlatformAdmin(actor);
  for (const category of directoryCategories) {
    console.log("Consultando " + category + "…");
    const resource = (await listResources(category))[0];
    if (!resource) throw new Error("Nenhum recurso oficial disponível para " + category);
    const downloaded = await downloadResource(category, resource.id);
    let parsed = await parseCadasturFile(downloaded.bytes, downloaded.format);
    for (const sheet of parsed.sheets) {
      if (parsed.sheet !== sheet.name)
        parsed = await parseCadasturFile(downloaded.bytes, downloaded.format, sheet.name);
      const mapping = { ...parsed.mapping };
      // Some guide PJ sheets contain an empty commercial phone column and a populated institutional one.
      for (const [field, fallback] of [
        ["phone", "Telefone Institucional"],
        ["email", "E-mail Institucional"],
      ] as const) {
        const rows = parsed.data.filter((row) => row[mapping.uf] === "AM");
        if (!rows.some((row) => (row[mapping[field]] || "").replace(/[-*\s]/g, ""))) {
          const index = parsed.headers.findIndex(
            (header) => normalizeLabel(header) === normalizeLabel(fallback),
          );
          if (index >= 0) mapping[field] = index;
        }
      }
      const preview = await createPreview(
        db,
        actor,
        parsed,
        {
          category,
          period: downloaded.period,
          uf: "AM",
          sheet: parsed.sheet,
          mapping,
          checksum: parsed.checksum,
          include_contacts: true,
        },
        downloaded.source,
      );
      console.log(
        JSON.stringify({
          category,
          sheet: parsed.sheet,
          period: preview.period,
          counts: preview.counts,
          issues: preview.issues,
        }),
      );
      if (preview.counts.added + preview.counts.updated) {
        await commitImport(db, actor, { id: preview.id });
        if (publish) {
          const entries = await many<{
            id: string;
            company_id: string | null;
            guide_id: string | null;
          }>(
            db,
            "SELECT id,company_id,guide_id FROM cadastur_entries WHERE import_id=?",
            preview.id,
          );
          for (const entry of entries) await reviewEntry(db, actor, { ...entry, published: true });
        }
      }
    }
  }
  if (
    !postgres &&
    (db.pragma("integrity_check", { simple: true }) !== "ok" ||
      (db.pragma("foreign_key_check") as unknown[]).length)
  )
    throw new Error("Falha na verificação final do banco.");
  console.log(
    JSON.stringify(
      await many(
        db,
        "SELECT category,COUNT(*) AS total,SUM(published) AS publicados FROM cadastur_entries GROUP BY category",
      ),
    ),
  );
} finally {
  if (postgres) await db.end();
  else db.close();
}
