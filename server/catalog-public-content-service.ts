import type { DatabaseExecutor } from "../db/index.ts";
import type { CatalogCategory } from "../lib/catalog-content.ts";
import { one, many } from "./platform-store.ts";
import { fromRow, type CatalogItemRow } from "./catalog-content-model.ts";

export async function publicCatalogItems(db: DatabaseExecutor, category: CatalogCategory) {
  return (
    await many<CatalogItemRow>(
      db,
      "SELECT * FROM catalog_items WHERE source_entry_id IS NULL AND category=? AND status='published' ORDER BY LOWER(city),LOWER(name)",
      category,
    )
  ).map(fromRow);
}

export async function publicCatalogOverlays(db: DatabaseExecutor, category: CatalogCategory) {
  return (
    await many<CatalogItemRow>(
      db,
      "SELECT * FROM catalog_items WHERE source_entry_id IS NOT NULL AND category=? AND status='published'",
      category,
    )
  ).map(fromRow);
}

export async function publicCatalogOverlay(db: DatabaseExecutor, sourceEntryId: string) {
  const row = await one<CatalogItemRow>(
    db,
    "SELECT * FROM catalog_items WHERE source_entry_id=? AND status='published'",
    sourceEntryId,
  );
  return row ? fromRow(row) : null;
}

export async function publicCatalogItem(db: DatabaseExecutor, id: string) {
  if (!/^[a-f0-9-]{36}$/i.test(id)) return null;
  const row = await one<CatalogItemRow>(
    db,
    "SELECT * FROM catalog_items WHERE id=? AND source_entry_id IS NULL AND status='published'",
    id,
  );
  return row ? fromRow(row) : null;
}
