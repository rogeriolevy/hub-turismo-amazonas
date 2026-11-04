import type { DatabaseExecutor } from "../../db/index.ts";
import { cadasturSources, type CadasturCategory } from "../../lib/cadastur-schema.ts";
import {
  publicCatalogItem,
  publicCatalogItems,
  publicCatalogOverlay,
  publicCatalogOverlays,
} from "../catalog-public-content-service.ts";
import { many, one } from "../platform-store.ts";
import { cachedPublicDirectory } from "./public-directory-cache.ts";
import {
  fromCadastur,
  fromHub,
  priority,
  withEditorialContent,
  publicCadasturProjection,
  publicCadasturVisibility,
  directoryCategories,
  type CadasturPublicProvider,
  type DirectoryCategory,
} from "./public-directory-model.ts";

export {
  directoryCategories,
  fromHub,
  providerFromDirectoryRow,
  regionCities,
} from "./public-directory-model.ts";
export type {
  DirectoryCategory,
  PublicDirectoryRow,
  PublicProvider,
} from "./public-directory-model.ts";
export { publicProviderSearchCte, searchProviders } from "./public-directory-search.ts";
export type { DirectorySearch } from "./public-directory-search.ts";

export async function publicCadasturProviders(db: DatabaseExecutor, category: DirectoryCategory) {
  return (
    await many<CadasturPublicProvider>(
      db,
      `SELECT ${publicCadasturProjection} FROM cadastur_entries WHERE ${publicCadasturVisibility} AND category=?`,
      category,
    )
  )
    .map(fromCadastur)
    .sort(
      (a, b) =>
        priority(a.city) - priority(b.city) ||
        a.name.localeCompare(b.name, "pt-BR") ||
        a.id.localeCompare(b.id),
    );
}

export async function publicProviders(db: DatabaseExecutor, category: DirectoryCategory) {
  return cachedPublicDirectory(db, `providers:${category}`, async () => {
    const [overlays, providers, items] = await Promise.all([
      publicCatalogOverlays(db, category),
      publicCadasturProviders(db, category),
      publicCatalogItems(db, category),
    ]);
    const overlayMap = new Map(overlays.map((item) => [item.source_entry_id!, item]));
    return [
      ...providers.map((entry) => withEditorialContent(entry, overlayMap.get(entry.id))),
      ...items.map(fromHub),
    ].sort(
      (a, b) =>
        priority(a.city) - priority(b.city) ||
        a.name.localeCompare(b.name, "pt-BR") ||
        a.id.localeCompare(b.id),
    );
  });
}

export async function publicCadasturPaths(db: DatabaseExecutor) {
  const placeholders = directoryCategories.map(() => "?").join(",");
  const entries = await many<{ id: string }>(
    db,
    `SELECT id FROM cadastur_entries WHERE ${publicCadasturVisibility} AND category IN (${placeholders})`,
    ...directoryCategories,
  );
  return entries.map((entry) => "/prestadores/" + entry.id);
}

export async function publicProvider(db: DatabaseExecutor, id: string) {
  if (!/^[a-f0-9-]{36}$/i.test(id)) return null;
  const entry = await one<CadasturPublicProvider>(
    db,
    `SELECT ${publicCadasturProjection} FROM cadastur_entries WHERE ${publicCadasturVisibility} AND id=?`,
    id,
  );
  if (entry && directoryCategories.includes(entry.category as DirectoryCategory))
    return withEditorialContent(
      fromCadastur(entry),
      (await publicCatalogOverlay(db, entry.id)) ?? undefined,
    );
  const item = await publicCatalogItem(db, id);
  return item ? fromHub(item) : null;
}

export function providerSource(category: CadasturCategory) {
  return "https://dados.turismo.gov.br/dataset/" + cadasturSources[category].dataset;
}
