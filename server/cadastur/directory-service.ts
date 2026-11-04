import { lockSuffix, type DatabaseExecutor } from "../../db/index.ts";
import { z } from "zod";
import {
  categorySchema,
  type RegistryEntry,
  type ImportHistory,
} from "../../lib/cadastur-schema.ts";
import { requirePlatformAdmin } from "../platform-access.ts";
import type { Actor } from "../platform-models.ts";
import { one, many, run, parse, write, audit } from "../platform-store.ts";
import { HttpError } from "../http.ts";
import { invalidatePublicDirectoryCache } from "./public-directory-cache.ts";

type Existing = RegistryEntry & { data_hash: string };

export async function reviewEntry(db: DatabaseExecutor, actor: Actor, input: unknown) {
  requirePlatformAdmin(actor);
  const data = parse(
    z
      .object({
        id: z.string().uuid(),
        company_id: z.string().uuid().nullable().default(null),
        guide_id: z.string().uuid().nullable().default(null),
        published: z.boolean().optional(),
      })
      .strict(),
    input,
  );
  const result = await write(db, async (tx) => {
    const entry = await one<Existing>(
      tx,
      "SELECT * FROM cadastur_entries WHERE id=?" + lockSuffix(tx),
      data.id,
    );
    if (!entry) throw new HttpError(404, "NOT_FOUND", "Registro não encontrado.");
    if (data.company_id) {
      const company = await one<{ kind: string }>(
        tx,
        "SELECT kind FROM companies WHERE id=?",
        data.company_id,
      );
      if (!company || entry.category !== "hospedagens" || company.kind !== "hotel")
        throw new HttpError(
          422,
          "LINK",
          "Hospedagens podem ser vinculadas a uma empresa hoteleira existente.",
        );
    }
    if (
      data.guide_id &&
      (entry.category !== "guias" ||
        !(await one(tx, "SELECT id FROM guides WHERE id=?", data.guide_id)))
    )
      throw new HttpError(422, "LINK", "Selecione um perfil de guia existente.");
    await run(
      tx,
      "UPDATE cadastur_entries SET review_status='reviewed',company_id=?,guide_id=?,published=? WHERE id=?",
      data.company_id,
      data.guide_id,
      Number(data.published ?? Boolean(entry.published)),
      data.id,
    );
    await audit(tx, actor.id, data.company_id, "cadastur.review", data.id);
    return { id: data.id };
  });
  invalidatePublicDirectoryCache(db);
  return result;
}
export async function listDirectory(db: DatabaseExecutor, actor: Actor, input: unknown) {
  requirePlatformAdmin(actor);
  const { category, page, q } = parse(
    z.object({
      category: categorySchema,
      page: z.coerce.number().int().min(1).max(10000).default(1),
      q: z.string().trim().max(100).default(""),
    }),
    input,
  );
  const filter = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const where = "e.category=? AND (e.name LIKE ? ESCAPE '\\' OR e.city LIKE ? ESCAPE '\\')";
  const [entries, total, history] = await Promise.all([
    many<RegistryEntry>(
      db,
      "SELECT e.id,e.category,e.external_id,e.name,e.uf,e.city,e.subtype,e.registry_status,e.valid_until,e.period,e.company_id,e.guide_id,e.review_status,e.imported_at,e.phone,e.email,e.address,e.website,e.languages,e.units,e.beds,e.published,CASE WHEN c.id IS NULL THEN NULL ELSE COALESCE(NULLIF(TRIM(c.trade_name),''),c.name) END AS company_name,g.name AS guide_name FROM cadastur_entries e LEFT JOIN companies c ON c.id=e.company_id LEFT JOIN guides g ON g.id=e.guide_id WHERE " +
        where +
        " ORDER BY e.name,e.id LIMIT 20 OFFSET ?",
      category,
      filter,
      filter,
      (page - 1) * 20,
    ),
    one<{ n: number }>(
      db,
      "SELECT CAST(COUNT(*) AS INTEGER) n FROM cadastur_entries e WHERE " + where,
      category,
      filter,
      filter,
    ),
    many<ImportHistory>(
      db,
      "SELECT id,category,period,created_at,status,summary FROM cadastur_imports WHERE category=? AND status='committed' ORDER BY created_at DESC LIMIT 10",
      category,
    ),
  ]);
  return {
    entries,
    total: total!.n,
    history,
    page,
  };
}
