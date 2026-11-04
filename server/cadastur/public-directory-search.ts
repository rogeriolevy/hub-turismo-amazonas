import type { DatabaseExecutor } from "../../db/index.ts";
import { normalizeLabel } from "../../lib/cadastur-schema.ts";
import { normalizeSearchTerms } from "../../lib/normalize-label.ts";
import { many, one } from "../platform-store.ts";
import { cachedPublicDirectory } from "./public-directory-cache.ts";
import {
  priority,
  providerFromDirectoryRow,
  type DirectoryCategory,
  type PublicDirectoryRow,
} from "./public-directory-model.ts";

export const publicProviderSearchCte = `WITH public_providers AS (
  SELECT
    e.id,
    e.category,
    COALESCE(NULLIF(o.name,''),e.name) AS name,
    e.uf,
    COALESCE(NULLIF(o.city,''),e.city) AS city,
    COALESCE(NULLIF(o.subtype,''),e.subtype) AS subtype,
    e.period,
    COALESCE(NULLIF(o.phone,''),e.phone) AS phone,
    COALESCE(NULLIF(o.email,''),e.email) AS email,
    COALESCE(NULLIF(o.address,''),e.address) AS address,
    e.website AS source_website,
    o.website AS editorial_website,
    e.languages,
    e.units,
    e.beds,
    COALESCE(o.summary,'') AS summary,
    COALESCE(o.description,'') AS description,
    COALESCE(o.details,'') AS details,
    COALESCE(o.image_urls_json,'[]') AS image_urls_json,
    'cadastur' AS source,
    CASE WHEN o.id IS NULL THEN 0 ELSE 1 END AS editorial
  FROM cadastur_entries e
  LEFT JOIN catalog_items o
    ON o.source_entry_id=e.id AND o.category=e.category AND o.status='published'
  WHERE e.published=1 AND e.review_status='reviewed' AND e.uf='AM' AND e.category=?
  UNION ALL
  SELECT
    c.id,
    c.category,
    c.name,
    'AM' AS uf,
    c.city,
    c.subtype,
    'Conteúdo Hub' AS period,
    c.phone,
    c.email,
    c.address,
    c.website AS source_website,
    NULL AS editorial_website,
    '' AS languages,
    NULL AS units,
    NULL AS beds,
    c.summary,
    c.description,
    c.details,
    c.image_urls_json,
    'hub' AS source,
    1 AS editorial
  FROM catalog_items c
  WHERE c.source_entry_id IS NULL AND c.status='published' AND c.category=?
)`;

type DirectoryFacets = { allTotal: number; cities: string[]; types: string[] };

async function publicDirectoryFacets(db: DatabaseExecutor, category: DirectoryCategory) {
  return cachedPublicDirectory(db, `facets:${category}`, async () => {
    const rows = await many<{
      city: string;
      subtype: string;
      all_total: number | string;
    }>(
      db,
      `${publicProviderSearchCte} SELECT DISTINCT city,subtype,COUNT(*) OVER() AS all_total FROM public_providers`,
      category,
      category,
    );
    return {
      allTotal: Number(rows[0]?.all_total ?? 0),
      cities: [...new Set(rows.map((row) => row.city))].sort(
        (a, b) => priority(a) - priority(b) || a.localeCompare(b, "pt-BR"),
      ),
      types: [...new Set(rows.map((row) => row.subtype.trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    } satisfies DirectoryFacets;
  });
}

export type DirectorySearch = {
  q?: string | string[];
  cidade?: string | string[];
  tipo?: string | string[];
  pagina?: string | string[];
  entrada?: string | string[];
  saida?: string | string[];
  pessoas?: string | string[];
  hotel_pagina?: string | string[];
};

export async function searchProviders(
  db: DatabaseExecutor,
  category: DirectoryCategory,
  input: DirectorySearch = {},
) {
  const q = typeof input.q === "string" ? input.q.trim().slice(0, 100) : "";
  const city = typeof input.cidade === "string" ? input.cidade.trim().slice(0, 100) : "";
  const requestedType = typeof input.tipo === "string" ? input.tipo.trim().slice(0, 100) : "";
  const { allTotal, cities, types } = await publicDirectoryFacets(db, category);
  const type =
    types.find((candidate) => normalizeLabel(candidate) === normalizeLabel(requestedType)) ??
    requestedType;
  const searchTerms = normalizeSearchTerms(q);
  const conditions: string[] = [];
  const values: unknown[] = [category, category];
  if (city) {
    conditions.push("hub_normalize_label(city)=?");
    values.push(normalizeLabel(city));
  }
  if (type) {
    conditions.push("hub_normalize_label(subtype)=?");
    values.push(normalizeLabel(type));
  }
  if (searchTerms.length) {
    conditions.push(
      searchTerms
        .map(
          () =>
            "hub_normalize_label(name || ' ' || city || ' ' || subtype || ' ' || summary || ' ' || description || ' ' || details) LIKE ?",
        )
        .join(" AND "),
    );
    for (const term of searchTerms) values.push("%" + term + "%");
  }
  const where = conditions.length ? " WHERE " + conditions.join(" AND ") : "";
  const count = await one<{ total: number | string }>(
    db,
    `${publicProviderSearchCte} SELECT COUNT(*) AS total FROM public_providers${where}`,
    ...values,
  );
  const total = Number(count?.total ?? 0);
  const pages = Math.max(1, Math.ceil(total / 24));
  const requested =
    typeof input.pagina === "string" && /^\d{1,6}$/.test(input.pagina) ? Number(input.pagina) : 1;
  const page = Math.max(1, Math.min(pages, requested));
  const entries = await many<PublicDirectoryRow>(
    db,
    `${publicProviderSearchCte} SELECT * FROM public_providers${where} ORDER BY CASE hub_normalize_label(city) WHEN 'maues' THEN 0 WHEN 'parintins' THEN 1 WHEN 'boavistadoramos' THEN 2 ELSE 3 END,hub_normalize_label(name),id LIMIT ? OFFSET ?`,
    ...values,
    24,
    (page - 1) * 24,
  );
  return {
    entries: entries.map(providerFromDirectoryRow),
    total,
    allTotal,
    cities,
    types,
    q,
    city,
    type,
    page,
    pages,
  };
}
