import type { DatabaseExecutor } from "../db/index.ts";
import { catalogItemSchema } from "../lib/platform-schema/catalog.ts";
import { requirePlatformAdmin } from "./platform-access.ts";
import { HttpError } from "./http.ts";
import { one, many, run, parse, audit, write } from "./platform-store.ts";
import { removeCatalogImages } from "./media-storage.ts";
import type { Actor } from "./platform-models.ts";
import { invalidatePublicDirectoryCache } from "./cadastur/public-directory-cache.ts";
import { imageList, type CatalogItemRow } from "./catalog-content-model.ts";

async function removeUnusedUploads(db: DatabaseExecutor, candidates: string[]) {
  if (!candidates.length) return;
  const used = new Set<string>();
  for (const row of await many<{ image_urls_json: string }>(
    db,
    "SELECT image_urls_json FROM catalog_items",
  ))
    for (const image of imageList(row.image_urls_json)) used.add(image);
  await removeCatalogImages([...new Set(candidates)].filter((image) => !used.has(image)));
}

export async function saveCatalogItem(db: DatabaseExecutor, actor: Actor, input: unknown) {
  requirePlatformAdmin(actor);
  const data = parse(catalogItemSchema, input);
  const old = data.id
    ? await one<CatalogItemRow>(db, "SELECT * FROM catalog_items WHERE id=?", data.id)
    : undefined;
  if (data.id && !old) throw new HttpError(404, "NOT_FOUND", "Conteúdo não encontrado.");
  if (old && old.category !== data.category)
    throw new HttpError(409, "CATEGORY", "A categoria não pode ser alterada após a criação.");
  if (data.source_entry_id) {
    const source = await one<{ id: string; category: string }>(
      db,
      "SELECT id,category FROM cadastur_entries WHERE id=?",
      data.source_entry_id,
    );
    if (!source || source.category !== data.category)
      throw new HttpError(422, "SOURCE", "O registro do Cadastur não pertence a este módulo.");
    const linked = await one<{ id: string }>(
      db,
      "SELECT id FROM catalog_items WHERE source_entry_id=? AND id!=?",
      data.source_entry_id,
      data.id || "",
    );
    if (linked)
      throw new HttpError(409, "SOURCE_LINKED", "Este registro já possui complemento editorial.");
  }
  const id = data.id || crypto.randomUUID();
  const now = new Date().toISOString();

  await write(db, async (tx) => {
    await run(
      tx,
      `INSERT INTO catalog_items (
        id,source_entry_id,category,name,slug,city,subtype,summary,description,details,address,phone,email,website,
        image_urls_json,status,created_at,updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        source_entry_id=excluded.source_entry_id,name=excluded.name,slug=excluded.slug,city=excluded.city,subtype=excluded.subtype,
        summary=excluded.summary,description=excluded.description,details=excluded.details,
        address=excluded.address,phone=excluded.phone,email=excluded.email,website=excluded.website,
        image_urls_json=excluded.image_urls_json,status=excluded.status,updated_at=excluded.updated_at`,
      id,
      data.source_entry_id,
      data.category,
      data.name,
      data.slug,
      data.city,
      data.subtype,
      data.summary,
      data.description,
      data.details,
      data.address,
      data.phone,
      data.email,
      data.website,
      JSON.stringify(data.image_urls),
      data.status,
      old?.created_at || now,
      now,
    );
    await audit(tx, actor.id, null, old ? "catalog.updated" : "catalog.created", id);
  });

  invalidatePublicDirectoryCache(db);
  await removeUnusedUploads(
    db,
    old ? imageList(old.image_urls_json).filter((url) => !data.image_urls.includes(url)) : [],
  );
  return { id };
}

export async function deleteCatalogItem(db: DatabaseExecutor, actor: Actor, id: string) {
  requirePlatformAdmin(actor);
  const old = await one<CatalogItemRow>(db, "SELECT * FROM catalog_items WHERE id=?", id);
  if (!old) throw new HttpError(404, "NOT_FOUND", "Conteúdo não encontrado.");
  await write(db, async (tx) => {
    await run(tx, "DELETE FROM catalog_items WHERE id=?", id);
    await audit(tx, actor.id, null, "catalog.deleted", id);
  });
  invalidatePublicDirectoryCache(db);
  await removeUnusedUploads(db, imageList(old.image_urls_json));
  return { ok: true };
}
