import type { DatabaseExecutor } from "../db/index.ts";
import { catalogItemDeleteSchema } from "../lib/platform-schema/catalog.ts";
import { json } from "./http.ts";
import { parse } from "./platform-store.ts";
import type { Actor } from "./platform-models.ts";
import {
  deleteCatalogItem,
  listCatalogItemsPage,
  saveCatalogItem,
} from "./catalog-content-service.ts";

export async function getPlatformCatalog(
  db: DatabaseExecutor,
  actor: Actor,
  path: string,
  url: URL,
) {
  if (path !== "conteudos") return null;

  const result = await listCatalogItemsPage(db, actor, {
    category: url.searchParams.get("categoria") ?? "hospedagens",
    page: url.searchParams.get("page"),
    sourceEntryId: url.searchParams.get("cadastur") ?? undefined,
  });
  return json({
    data: result.items,
    sourceItem: result.sourceItem,
    meta: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    },
    counts: result.counts,
  });
}

export async function postPlatformCatalog(
  db: DatabaseExecutor,
  actor: Actor,
  path: string,
  body: unknown,
) {
  if (path === "conteudos") return json({ data: await saveCatalogItem(db, actor, body) });

  if (path === "excluir-conteudo") {
    const input = parse(catalogItemDeleteSchema, body);
    return json({ data: await deleteCatalogItem(db, actor, input.id) });
  }

  return null;
}
