import { normalizeLabel, type RegistryData } from "../../lib/cadastur-schema.ts";
import type { CatalogCategory, CatalogItem } from "../../lib/catalog-content.ts";
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

export type CadasturPublicProvider = Omit<
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
export const publicCadasturProjection =
  "id,category,name,uf,city,subtype,period,phone,email,address,website,languages,units,beds";
export const publicCadasturVisibility = "published=1 AND review_status='reviewed' AND uf='AM'";

export const priority = (city: string) => {
  const index = regionCities.findIndex((name) => normalizeLabel(name) === normalizeLabel(city));
  return index < 0 ? 3 : index;
};

export function fromCadastur(entry: CadasturPublicProvider): PublicProvider {
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

export function withEditorialContent(entry: PublicProvider, item?: CatalogItem): PublicProvider {
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

export type PublicDirectoryRow = Omit<PublicProvider, "website" | "images" | "editorial"> & {
  editorial: boolean | number | null;
  source_website: string | null;
  editorial_website: string | null;
  image_urls_json: string | null;
};

export function providerFromDirectoryRow(row: PublicDirectoryRow): PublicProvider {
  let images: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.image_urls_json ?? "[]");
    if (Array.isArray(parsed) && parsed.every((image) => typeof image === "string"))
      images = parsed;
  } catch {
    images = [];
  }
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    uf: row.uf,
    city: row.city,
    subtype: row.subtype,
    period: row.period,
    phone: row.phone,
    email: row.email,
    address: row.address,
    website: publicWebsite(row.editorial_website || "") || publicWebsite(row.source_website || ""),
    languages: row.languages,
    units: row.units,
    beds: row.beds,
    summary: row.summary,
    description: row.description,
    details: row.details,
    images,
    source: row.source as PublicProvider["source"],
    editorial: Boolean(row.editorial),
  };
}
