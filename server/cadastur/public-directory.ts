import type Database from "better-sqlite3";
import {
  normalizeLabel,
  cadasturSources,
  type CadasturCategory,
  type RegistryData,
} from "../../lib/cadastur-schema.ts";
import { publicWebsite } from "../../lib/public-contacts.ts";

export type PublicProvider = Omit<
  RegistryData,
  "external_id" | "registry_status" | "valid_until"
> & {
  id: string;
  category: CadasturCategory;
  period: string;
};
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
export function publicProviders(db: Database.Database, category: CadasturCategory) {
  return db
    .prepare<[string], PublicProvider>(
      `SELECT ${projection} FROM cadastur_entries WHERE ${visible} AND category=?`,
    )
    .all(category)
    .map((entry) => ({ ...entry, website: publicWebsite(entry.website) }))
    .sort(
      (a, b) =>
        priority(a.city) - priority(b.city) ||
        a.name.localeCompare(b.name, "pt-BR") ||
        a.id.localeCompare(b.id),
    );
}
export function publicProvider(db: Database.Database, id: string) {
  if (!/^[a-f0-9-]{36}$/i.test(id)) return null;
  const entry = db
    .prepare<[string], PublicProvider>(
      `SELECT ${projection} FROM cadastur_entries WHERE ${visible} AND id=?`,
    )
    .get(id);
  return entry && directoryCategories.includes(entry.category as DirectoryCategory)
    ? { ...entry, website: publicWebsite(entry.website) }
    : null;
}
export type DirectorySearch = {
  q?: string | string[];
  cidade?: string | string[];
  pagina?: string | string[];
};
export function searchProviders(
  db: Database.Database,
  category: DirectoryCategory,
  input: DirectorySearch = {},
) {
  const q = typeof input.q === "string" ? input.q.trim().slice(0, 100) : "";
  const city = typeof input.cidade === "string" ? input.cidade.trim().slice(0, 100) : "";
  const all = publicProviders(db, category);
  const cities = [...new Set(all.map((r) => r.city))].sort(
    (a, b) => priority(a) - priority(b) || a.localeCompare(b, "pt-BR"),
  );
  const found = all.filter(
    (r) =>
      (!city || normalizeLabel(city) === normalizeLabel(r.city)) &&
      (!q || normalizeLabel(`${r.name} ${r.city} ${r.subtype}`).includes(normalizeLabel(q))),
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
    q,
    city,
    page,
    pages,
  };
}
export function providerSource(category: CadasturCategory) {
  return "https://dados.turismo.gov.br/dataset/" + cadasturSources[category].dataset;
}
