import type Database from "better-sqlite3";
import { unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { catalogItemSchema } from "../lib/platform-schema.ts";
import type { CatalogCategory, CatalogItem } from "../lib/catalog-content.ts";
import { requirePlatformAdmin } from "./platform-access.ts";
import { HttpError } from "./http.ts";
import { one, many, parse, audit, write } from "./platform-store.ts";
import type { Actor } from "./platform-models.ts";

type CatalogItemRow = Omit<CatalogItem, "image_urls"> & { image_urls_json: string };

function imageList(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string")
      ? (parsed as string[])
      : [];
  } catch {
    return [];
  }
}

function fromRow(row: CatalogItemRow): CatalogItem {
  const { image_urls_json, ...item } = row;
  return { ...item, image_urls: imageList(image_urls_json) };
}

function removeUnusedUploads(db: Database.Database, candidates: string[]) {
  if (!candidates.length) return;
  const used = new Set<string>();
  for (const row of many<{ image_urls_json: string }>(
    db,
    "SELECT image_urls_json FROM catalog_items",
  ))
    for (const image of imageList(row.image_urls_json)) used.add(image);
  for (const image of new Set(candidates)) {
    const match = /^\/uploads\/catalog\/([a-f0-9-]{36}\.(?:jpg|png|webp))$/i.exec(image);
    if (!match || used.has(image)) continue;
    try {
      unlinkSync(resolve(process.cwd(), "public", "uploads", "catalog", match[1]));
    } catch {
      // A missing or locked file does not undo the saved catalog record.
    }
  }
}

export function listCatalogItems(db: Database.Database, actor: Actor, category?: CatalogCategory) {
  requirePlatformAdmin(actor);
  const rows = category
    ? many<CatalogItemRow>(
        db,
        "SELECT * FROM catalog_items WHERE category=? ORDER BY updated_at DESC,name COLLATE NOCASE",
        category,
      )
    : many<CatalogItemRow>(db, "SELECT * FROM catalog_items ORDER BY category,name COLLATE NOCASE");
  return rows.map(fromRow);
}

export function publicCatalogItems(db: Database.Database, category: CatalogCategory) {
  return many<CatalogItemRow>(
    db,
    "SELECT * FROM catalog_items WHERE source_entry_id IS NULL AND category=? AND status='published' ORDER BY city COLLATE NOCASE,name COLLATE NOCASE",
    category,
  ).map(fromRow);
}

export function publicCatalogOverlays(db: Database.Database, category: CatalogCategory) {
  return many<CatalogItemRow>(
    db,
    "SELECT * FROM catalog_items WHERE source_entry_id IS NOT NULL AND category=? AND status='published'",
    category,
  ).map(fromRow);
}

export function publicCatalogOverlay(db: Database.Database, sourceEntryId: string) {
  const row = one<CatalogItemRow>(
    db,
    "SELECT * FROM catalog_items WHERE source_entry_id=? AND status='published'",
    sourceEntryId,
  );
  return row ? fromRow(row) : null;
}

export function publicCatalogItem(db: Database.Database, id: string) {
  if (!/^[a-f0-9-]{36}$/i.test(id)) return null;
  const row = one<CatalogItemRow>(
    db,
    "SELECT * FROM catalog_items WHERE id=? AND source_entry_id IS NULL AND status='published'",
    id,
  );
  return row ? fromRow(row) : null;
}

export function saveCatalogItem(db: Database.Database, actor: Actor, input: unknown) {
  requirePlatformAdmin(actor);
  const data = parse(catalogItemSchema, input);
  const old = data.id
    ? one<CatalogItemRow>(db, "SELECT * FROM catalog_items WHERE id=?", data.id)
    : undefined;
  if (data.id && !old) throw new HttpError(404, "NOT_FOUND", "Conteúdo não encontrado.");
  if (old && old.category !== data.category)
    throw new HttpError(409, "CATEGORY", "A categoria não pode ser alterada após a criação.");
  if (data.source_entry_id) {
    const source = one<{ id: string; category: string }>(
      db,
      "SELECT id,category FROM cadastur_entries WHERE id=?",
      data.source_entry_id,
    );
    if (!source || source.category !== data.category)
      throw new HttpError(422, "SOURCE", "O registro do Cadastur não pertence a este módulo.");
    const linked = one<{ id: string }>(
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

  write(db, () => {
    db.prepare(
      `INSERT INTO catalog_items (
        id,source_entry_id,category,name,slug,city,subtype,summary,description,details,address,phone,email,website,
        image_urls_json,status,created_at,updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        source_entry_id=excluded.source_entry_id,name=excluded.name,slug=excluded.slug,city=excluded.city,subtype=excluded.subtype,
        summary=excluded.summary,description=excluded.description,details=excluded.details,
        address=excluded.address,phone=excluded.phone,email=excluded.email,website=excluded.website,
        image_urls_json=excluded.image_urls_json,status=excluded.status,updated_at=excluded.updated_at`,
    ).run(
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
    audit(db, actor.id, null, old ? "catalog.updated" : "catalog.created", id);
  });

  removeUnusedUploads(
    db,
    old ? imageList(old.image_urls_json).filter((url) => !data.image_urls.includes(url)) : [],
  );
  return { id };
}

export function deleteCatalogItem(db: Database.Database, actor: Actor, id: string) {
  requirePlatformAdmin(actor);
  const old = one<CatalogItemRow>(db, "SELECT * FROM catalog_items WHERE id=?", id);
  if (!old) throw new HttpError(404, "NOT_FOUND", "Conteúdo não encontrado.");
  write(db, () => {
    db.prepare("DELETE FROM catalog_items WHERE id=?").run(id);
    audit(db, actor.id, null, "catalog.deleted", id);
  });
  removeUnusedUploads(db, imageList(old.image_urls_json));
  return { ok: true };
}
