import { lockSuffix, type DatabaseExecutor } from "../../db/index.ts";
import { z } from "zod";
import { requirePlatformAdmin } from "../platform-access.ts";
import type { Actor } from "../platform-models.ts";
import { one, run, parse, write, audit } from "../platform-store.ts";
import { HttpError } from "../http.ts";
import { invalidatePublicDirectoryCache } from "./public-directory-cache.ts";
import type { Existing, Staged } from "./import-model.ts";

type Batch = {
  id: string;
  actor_id: string;
  status: string;
  payload: string | null;
  summary: string;
  expires_at: string;
  category: string;
  period: string;
  source_json: string;
};

export async function commitImport(db: DatabaseExecutor, actor: Actor, input: unknown) {
  requirePlatformAdmin(actor);
  const { id } = parse(z.object({ id: z.string().uuid() }).strict(), input);
  const result = await write(db, async (tx) => {
    const batch = await one<Batch>(
      tx,
      "SELECT * FROM cadastur_imports WHERE id=? AND actor_id=?" + lockSuffix(tx),
      id,
      actor.id,
    );
    if (!batch) throw new HttpError(404, "NOT_FOUND", "Prévia não encontrada.");
    if (batch.status === "committed") return { id, counts: JSON.parse(batch.summary) };
    if (!batch.payload || batch.status !== "preview" || batch.expires_at < new Date().toISOString())
      throw new HttpError(
        409,
        "EXPIRED",
        "A prévia expirou ou foi substituída. Gere uma nova prévia.",
      );
    const rows = JSON.parse(batch.payload) as Staged[];
    if (!rows.some((row) => row.action !== "unchanged"))
      throw new HttpError(422, "NO_CHANGES", "Não há inclusões ou alterações para confirmar.");
    const now = new Date().toISOString();
    for (const entry of rows) {
      const current = await one<Existing>(
        tx,
        "SELECT * FROM cadastur_entries WHERE category=? AND external_id=?",
        batch.category,
        entry.record.external_id,
      );
      if (
        (current?.data_hash || null) !== entry.previous ||
        (current?.period || null) !== entry.previousPeriod
      )
        throw new HttpError(
          409,
          "STALE_PREVIEW",
          "O diretório mudou desde a prévia. Gere outra prévia antes de confirmar.",
        );
      if (entry.action === "unchanged") continue;
      const record = entry.record;
      await run(
        tx,
        "INSERT INTO cadastur_entries (id,category,external_id,name,uf,city,subtype,registry_status,valid_until,period,data_hash,source_json,import_id,imported_at,phone,email,address,website,languages,units,beds)\n        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(category,external_id) DO UPDATE SET name=excluded.name,uf=excluded.uf,city=excluded.city,subtype=excluded.subtype,registry_status=excluded.registry_status,valid_until=excluded.valid_until,period=excluded.period,data_hash=excluded.data_hash,source_json=excluded.source_json,import_id=excluded.import_id,imported_at=excluded.imported_at,phone=excluded.phone,email=excluded.email,address=excluded.address,website=excluded.website,languages=excluded.languages,units=excluded.units,beds=excluded.beds,review_status='pending',published=0",
        crypto.randomUUID(),
        batch.category,
        record.external_id,
        record.name,
        record.uf,
        record.city,
        record.subtype,
        record.registry_status,
        record.valid_until,
        batch.period,
        entry.hash,
        batch.source_json,
        id,
        now,
        record.phone,
        record.email,
        record.address,
        record.website,
        record.languages,
        record.units,
        record.beds,
      );
    }
    await run(
      tx,
      "UPDATE cadastur_imports SET status='committed',payload=NULL,committed_at=? WHERE id=?",
      now,
      id,
    );
    await audit(tx, actor.id, null, "cadastur.import", id);
    return { id, counts: JSON.parse(batch.summary) };
  });
  invalidatePublicDirectoryCache(db);
  return result;
}
