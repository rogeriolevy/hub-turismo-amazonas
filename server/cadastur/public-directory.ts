import type Database from "better-sqlite3";
import {
  normalizeLabel,
  cadasturSources,
  type CadasturCategory,
  type RegistryData,
} from "../../lib/cadastur-schema.ts";
import type { CatalogCategory, CatalogItem } from "../../lib/catalog-content.ts";
import {
  publicCatalogItem,
  publicCatalogItems,
  publicCatalogOverlay,
  publicCatalogOverlays,
} from "../catalog-content-service.ts";
import { publicWebsite } from "../../lib/public-contacts.ts";

export type PublicProvider = Omit<
  RegistryData,
  "external_id" | "registry_status" | "valid_until"
> & {
  id: string;
  category: CatalogCategory;
  period: string;
  summary: string;
  description: string;
  details: string;
  images: string[];
  source: "cadastur" | "hub";
  editorial: boolean;
};
type CadasturPublicProvider = Omit<
  PublicProvider,
  "summary" | "description" | "details" | "images" | "source" | "editorial"
>;
export const directoryCategories = [
  "hospedagens",
  "gastronomia",
  "guias",
  "agencias",
  "servicos",
] as const;
export type DirectoryCategory = (typeof directoryCategories)[number];
export const regionCities = ["Maués", "Parintins", "Boa Vista do Ramos"];
const projection =
  "id,category,name,uf,city,subtype,period,phone,email,address,website,languages,units,beds";
const visible = "published=1 AND review_status='reviewed' AND uf='AM'";
const priority = (city: string) => {
  const index = regionCities.findIndex((name) => normalizeLabel(name) === normalizeLabel(city));
  return index < 0 ? 3 : index;
};

function fromCadastur(entry: CadasturPublicProvider): PublicProvider {
  return {
    ...entry,
    website: publicWebsite(entry.website),
    summary: "",
    description: "",
    details: "",
    images: [],
    source: "cadastur",
    editorial: false,
  };
}

export function fromHub(item: CatalogItem): PublicProvider {
  return {
    id: item.id,
    category: item.category,
    name: item.name,
    uf: "AM",
    city: item.city,
    subtype: item.subtype,
    period: "Conteúdo Hub",
    phone: item.phone,
    email: item.email,
    address: item.address,
    website: publicWebsite(item.website),
    languages: "",
    units: null,
    beds: null,
    summary: item.summary,
    description: item.description,
    details: item.details,
    images: item.image_urls,
    source: "hub",
    editorial: true,
  };
}

function withEditorialContent(entry: PublicProvider, item?: CatalogItem): PublicProvider {
  if (!item) return entry;
  return {
    ...entry,
    name: item.name || entry.name,
    city: item.city || entry.city,
    subtype: item.subtype || entry.subtype,
    phone: item.phone || entry.phone,
    email: item.email || entry.email,
    address: item.address || entry.address,
    website: publicWebsite(item.website) || entry.website,
    summary: item.summary,
    description: item.description,
    details: item.details,
    images: item.image_urls,
    editorial: true,
  };
}

export function publicCadasturProviders(db: Database.Database, category: DirectoryCategory) {
  return db
    .prepare<[string], CadasturPublicProvider>(
      `SELECT ${projection} FROM cadastur_entries WHERE ${visible} AND category=?`,
    )
    .all(category)
    .map(fromCadastur)
    .sort(
      (a, b) =>
        priority(a.city) - priority(b.city) ||
        a.name.localeCompare(b.name, "pt-BR") ||
        a.id.localeCompare(b.id),
    );
}

export function publicProviders(db: Database.Database, category: DirectoryCategory) {
  const overlays = new Map(
    publicCatalogOverlays(db, category).map((item) => [item.source_entry_id!, item]),
  );
  return [
    ...publicCadasturProviders(db, category).map((entry) =>
      withEditorialContent(entry, overlays.get(entry.id)),
    ),
    ...publicCatalogItems(db, category).map(fromHub),
  ].sort(
    (a, b) =>
      priority(a.city) - priority(b.city) ||
      a.name.localeCompare(b.name, "pt-BR") ||
      a.id.localeCompare(b.id),
  );
}

export function publicProvider(db: Database.Database, id: string) {
  if (!/^[a-f0-9-]{36}$/i.test(id)) return null;
  const entry = db
    .prepare<[string], CadasturPublicProvider>(
      `SELECT ${projection} FROM cadastur_entries WHERE ${visible} AND id=?`,
    )
    .get(id);
  if (entry && directoryCategories.includes(entry.category as DirectoryCategory))
    return withEditorialContent(
      fromCadastur(entry),
      publicCatalogOverlay(db, entry.id) ?? undefined,
    );
  const item = publicCatalogItem(db, id);
  return item ? fromHub(item) : null;
}

export type DirectorySearch = {
  q?: string | string[];
  cidade?: string | string[];
  tipo?: string | string[];
  pagina?: string | string[];
};
export function searchProviders(
  db: Database.Database,
  category: DirectoryCategory,
  input: DirectorySearch = {},
) {
  const q = typeof input.q === "string" ? input.q.trim().slice(0, 100) : "";
  const city = typeof input.cidade === "string" ? input.cidade.trim().slice(0, 100) : "";
  const requestedType = typeof input.tipo === "string" ? input.tipo.trim().slice(0, 100) : "";
  const all = publicProviders(db, category);
  const cities = [...new Set(all.map((r) => r.city))].sort(
    (a, b) => priority(a) - priority(b) || a.localeCompare(b, "pt-BR"),
  );
  const types = [...new Set(all.map((r) => r.subtype.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
  const type =
    types.find((candidate) => normalizeLabel(candidate) === normalizeLabel(requestedType)) ??
    requestedType;
  const found = all.filter(
    (r) =>
      (!city || normalizeLabel(city) === normalizeLabel(r.city)) &&
      (!type || normalizeLabel(type) === normalizeLabel(r.subtype)) &&
      (!q ||
        normalizeLabel(
          `${r.name} ${r.city} ${r.subtype} ${r.summary} ${r.description} ${r.details}`,
        ).includes(normalizeLabel(q))),
  );
  const pages = Math.max(1, Math.ceil(found.length / 24));
  const requested =
    typeof input.pagina === "string" && /^\d{1,6}$/.test(input.pagina) ? Number(input.pagina) : 1;
  const page = Math.max(1, Math.min(pages, requested));
  return {
    entries: found.slice((page - 1) * 24, page * 24),
    total: found.length,
    allTotal: all.length,
    cities,
    types,
    q,
    city,
    type,
    page,
    pages,
  };
}
export function providerSource(category: CadasturCategory) {
  return "https://dados.turismo.gov.br/dataset/" + cadasturSources[category].dataset;
}
