import { normalizeLabel } from "../lib/normalize-label.ts";
import type { Guide, Tour } from "./platform-models.ts";
import {
  providerFromDirectoryRow,
  regionCities,
  type PublicDirectoryRow,
  type PublicProvider,
} from "./cadastur/public-directory.ts";

type TourCardData = Pick<Tour, "id" | "slug" | "name" | "city" | "description" | "price_cents">;
type GuideCardData = Pick<Guide, "id" | "slug" | "name" | "bio" | "languages"> & {
  city: string;
  company_name: string;
};
export type ExperienceKind = "tour" | "activity" | "provider" | "guide";

export type ExperienceResult =
  | { key: string; kind: "tour"; tour: TourCardData }
  | { key: string; kind: "activity"; provider: PublicProvider }
  | { key: string; kind: "provider"; provider: PublicProvider }
  | { key: string; kind: "guide"; guide: GuideCardData };

export type ExperienceDirectoryPage = {
  results: ExperienceResult[];
  total: number;
  page: number;
  pages: number;
  q: string;
  city: string;
  type: "guia" | "atividade" | "";
  cities: string[];
  hasCadasturProviders: boolean;
};

export type ExperienceRow = {
  kind: ExperienceKind;
  id: string;
  name: string;
  city: string;
  slug: string | null;
  description: string | null;
  price_cents: number | null;
  company_name: string | null;
  category: PublicProvider["category"] | null;
  uf: string | null;
  subtype: string | null;
  period: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  source_website: string | null;
  editorial_website: string | null;
  languages: string | null;
  units: number | null;
  beds: number | null;
  summary: string | null;
  details: string | null;
  image_urls_json: string | null;
  source: "cadastur" | "hub" | null;
  editorial: boolean | number | null;
  bio: string | null;
};

export function experienceCityPriority(city: string) {
  const index = regionCities.findIndex((name) => normalizeLabel(name) === normalizeLabel(city));
  return index < 0 ? 99 : index;
}

function required(value: string | null, field: string) {
  if (value === null) throw new Error(`Registro público sem o campo obrigatório ${field}.`);
  return value;
}

function providerFromExperience(row: ExperienceRow): PublicProvider {
  const providerRow: PublicDirectoryRow = {
    id: row.id,
    category: row.category!,
    name: row.name,
    uf: row.uf ?? "AM",
    city: row.city,
    subtype: row.subtype ?? "",
    period: row.period ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    address: row.address ?? "",
    source_website: row.source_website,
    editorial_website: row.editorial_website,
    languages: row.languages ?? "",
    units: row.units,
    beds: row.beds,
    summary: row.summary ?? "",
    description: row.description ?? "",
    details: row.details ?? "",
    image_urls_json: row.image_urls_json,
    source: row.source!,
    editorial: row.editorial,
  };
  return providerFromDirectoryRow(providerRow);
}

export function experienceResultsFromRows(rows: ExperienceRow[]): ExperienceResult[] {
  return rows.map((row): ExperienceResult => {
    if (row.kind === "tour")
      return {
        key: `tour:${row.id}`,
        kind: "tour",
        tour: {
          id: row.id,
          slug: required(row.slug, "slug"),
          name: row.name,
          city: row.city,
          description: required(row.description, "description"),
          price_cents: row.price_cents ?? 0,
        },
      };
    if (row.kind === "guide")
      return {
        key: `guide:${row.id}`,
        kind: "guide",
        guide: {
          id: row.id,
          slug: required(row.slug, "slug"),
          name: row.name,
          city: row.city,
          languages: row.languages ?? "",
          bio: row.bio ?? "",
          company_name: required(row.company_name, "company_name"),
        },
      };
    return {
      key: `${row.kind}:${row.id}`,
      kind: row.kind,
      provider: providerFromExperience(row),
    };
  });
}
