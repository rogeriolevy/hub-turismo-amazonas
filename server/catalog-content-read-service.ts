import type { DatabaseExecutor } from "../db/index.ts";
import { z } from "zod";
import {
  catalogCategories,
  type CatalogCategory,
  type CatalogItem,
  type CatalogSourceEntry,
} from "../lib/catalog-content.ts";
import { requirePlatformAdmin } from "./platform-access.ts";
import { one, many, parse } from "./platform-store.ts";
import type { Actor } from "./platform-models.ts";
import { fromRow, type CatalogItemRow } from "./catalog-content-model.ts";

const CATALOG_PAGE_SIZE = 20;
const catalogListInput = z.object({
  category: z.enum(catalogCategories).default("hospedagens"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  sourceEntryId: z.string().max(128).optional(),
});

export async function listCatalogItemsPage(db: DatabaseExecutor, actor: Actor, input: unknown) {
  requirePlatformAdmin(actor);
  const { category, page: requestedPage, sourceEntryId } = parse(catalogListInput, input);
  const groupedCounts = await many<{
    category: CatalogCategory;
    total: number | string;
    published: number | string;
  }>(
    db,
    "SELECT category,COUNT(*) AS total,COUNT(CASE WHEN status='published' THEN 1 END) AS published FROM catalog_items GROUP BY category",
  );
  const counts = Object.fromEntries(
    catalogCategories.map((value) => {
      const row = groupedCounts.find((item) => item.category === value);
      return [value, { total: Number(row?.total ?? 0), published: Number(row?.published ?? 0) }];
    }),
  ) as Record<CatalogCategory, { total: number; published: number }>;
  const total = counts[category].total;
  const totalPages = Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const [rows, sourceRows] = await Promise.all([
    many<CatalogItemRow>(
      db,
      "SELECT * FROM catalog_items WHERE category=? ORDER BY updated_at DESC,LOWER(name),id LIMIT ? OFFSET ?",
      category,
      CATALOG_PAGE_SIZE,
      (page - 1) * CATALOG_PAGE_SIZE,
    ),
    sourceEntryId
      ? many<CatalogItemRow>(
          db,
          "SELECT * FROM catalog_items WHERE category=? AND source_entry_id=? LIMIT 1",
          category,
          sourceEntryId,
        )
      : Promise.resolve([] as CatalogItemRow[]),
  ]);
  return {
    items: rows.map(fromRow),
    sourceItem: sourceRows[0] ? fromRow(sourceRows[0]) : null,
    category,
    counts,
    total,
    page,
    pageSize: CATALOG_PAGE_SIZE,
    totalPages,
  };
}

export type CatalogContentManagementPage = {
  category: CatalogCategory;
  items: CatalogItem[];
  sourceEntry: CatalogSourceEntry | undefined;
  sourceItem: CatalogItem | null;
  counts: Record<CatalogCategory, { total: number; published: number }>;
  page: number;
  totalPages: number;
};

export async function catalogContentManagementPage(
  db: DatabaseExecutor,
  actor: Actor,
  query: { categoria?: string; cadastur?: string; page?: string },
): Promise<CatalogContentManagementPage> {
  requirePlatformAdmin(actor);
  const category = catalogCategories.includes(query.categoria as CatalogCategory)
    ? (query.categoria as CatalogCategory)
    : "hospedagens";
  const sourceRow = query.cadastur
    ? await one<CatalogSourceEntry & { category: string }>(
        db,
        "SELECT id,category,name,city,subtype,phone,email,address,website FROM cadastur_entries WHERE id=?",
        query.cadastur,
      )
    : undefined;
  const sourceEntry: CatalogSourceEntry | undefined =
    sourceRow?.category === category
      ? {
          id: sourceRow.id,
          category,
          name: sourceRow.name,
          city: sourceRow.city,
          subtype: sourceRow.subtype,
          phone: sourceRow.phone,
          email: sourceRow.email,
          address: sourceRow.address,
          website: sourceRow.website,
        }
      : undefined;
  const contentPage = await listCatalogItemsPage(db, actor, {
    category,
    page: query.page,
    sourceEntryId: sourceEntry?.id,
  });
  return {
    category,
    items: contentPage.items,
    sourceEntry,
    sourceItem: contentPage.sourceItem,
    counts: contentPage.counts,
    page: contentPage.page,
    totalPages: contentPage.totalPages,
  };
}
