import type { DatabaseExecutor } from "../db/index.ts";
import { normalizeLabel, normalizeSearchTerms } from "../lib/normalize-label.ts";
import { many, one } from "./platform-store.ts";
import { cachedPublicDirectory } from "./cadastur/public-directory-cache.ts";
import {
  publicProviderSearchCte,
  regionCities,
  type DirectorySearch,
} from "./cadastur/public-directory.ts";
import {
  experienceCityPriority,
  experienceResultsFromRows,
  type ExperienceDirectoryPage,
  type ExperienceRow,
} from "./experience-directory-model.ts";

export type { ExperienceDirectoryPage, ExperienceResult } from "./experience-directory-model.ts";

const experienceCte = `${publicProviderSearchCte}, experience_candidates AS (
  SELECT
    'tour' AS kind,t.id,t.name,t.city,
    hub_normalize_label(t.name || ' ' || t.city || ' ' || t.description || ' ' || COALESCE(NULLIF(TRIM(c.trade_name),''),c.name)) AS searchable_text,
    t.slug,t.description,t.price_cents,COALESCE(NULLIF(TRIM(c.trade_name),''),c.name) AS company_name,
    NULL AS category,'AM' AS uf,NULL AS subtype,NULL AS period,NULL AS phone,NULL AS email,NULL AS address,
    NULL AS source_website,NULL AS editorial_website,NULL AS languages,CAST(NULL AS INTEGER) AS units,CAST(NULL AS INTEGER) AS beds,
    NULL AS summary,NULL AS details,NULL AS image_urls_json,NULL AS source,NULL AS editorial,NULL AS bio
  FROM tours t
  JOIN companies c ON c.id=t.company_id
  WHERE t.published=1 AND c.status='published'
  UNION ALL
  SELECT
    'activity',c.id,c.name,c.city,
    hub_normalize_label(c.name || ' ' || c.city || ' ' || c.subtype || ' ' || c.summary || ' ' || c.description || ' ' || c.details),
    NULL,c.description,NULL,NULL,c.category,'AM',c.subtype,'Conteúdo Hub',c.phone,c.email,c.address,
    c.website,NULL,'',NULL,NULL,c.summary,c.details,c.image_urls_json,'hub',1,NULL
  FROM catalog_items c
  WHERE c.source_entry_id IS NULL AND c.category='passeios' AND c.status='published'
  UNION ALL
  SELECT
    'provider',p.id,p.name,p.city,
    hub_normalize_label(p.name || ' ' || p.city || ' ' || p.subtype || ' ' || p.summary || ' ' || p.description || ' ' || p.details || ' ' || p.languages),
    NULL,p.description,NULL,NULL,p.category,p.uf,p.subtype,p.period,p.phone,p.email,p.address,
    p.source_website,p.editorial_website,p.languages,p.units,p.beds,p.summary,p.details,p.image_urls_json,p.source,p.editorial,NULL
  FROM public_providers p
  WHERE p.category='guias'
  UNION ALL
  SELECT
    'guide',g.id,g.name,c.city,
    hub_normalize_label(g.name || ' ' || c.city || ' ' || g.languages || ' ' || g.bio || ' ' || COALESCE(NULLIF(TRIM(c.trade_name),''),c.name)),
    g.slug,NULL,NULL,COALESCE(NULLIF(TRIM(c.trade_name),''),c.name),NULL,'AM',NULL,NULL,NULL,NULL,NULL,
    NULL,NULL,g.languages,NULL,NULL,NULL,NULL,NULL,NULL,NULL,g.bio
  FROM guides g
  JOIN companies c ON c.id=g.company_id
  WHERE g.published=1 AND c.status='published'
)`;

function firstValue(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 100) ?? "";
}

async function experienceCities(db: DatabaseExecutor) {
  return cachedPublicDirectory(db, "experience:facets", async () =>
    many<{ city: string }>(
      db,
      `${experienceCte} SELECT DISTINCT city FROM experience_candidates`,
      "guias",
      "guias",
    ),
  );
}

export async function searchExperiences(
  db: DatabaseExecutor,
  input: DirectorySearch = {},
): Promise<ExperienceDirectoryPage> {
  const q = firstValue(input.q);
  const city = firstValue(input.cidade);
  const requestedType = firstValue(input.tipo);
  const type = requestedType === "guia" || requestedType === "atividade" ? requestedType : "";
  const searchTerms = normalizeSearchTerms(q);
  const conditions: string[] = [];
  const values: unknown[] = ["guias", "guias"];
  if (type)
    conditions.push(
      type === "guia" ? "kind IN ('guide','provider')" : "kind IN ('tour','activity')",
    );
  if (city) {
    conditions.push("hub_normalize_label(city)=?");
    values.push(normalizeLabel(city));
  }
  if (searchTerms.length) {
    conditions.push(searchTerms.map(() => "searchable_text LIKE ?").join(" AND "));
    for (const term of searchTerms) values.push("%" + term + "%");
  }
  const where = conditions.length ? " WHERE " + conditions.join(" AND ") : "";
  const [facetRows, count] = await Promise.all([
    experienceCities(db),
    one<{ total: number | string; has_cadastur_provider: number | string | null }>(
      db,
      `${experienceCte} SELECT COUNT(*) AS total,MAX(CASE WHEN kind='provider' AND source='cadastur' THEN 1 ELSE 0 END) AS has_cadastur_provider FROM experience_candidates${where}`,
      ...values,
    ),
  ]);
  const total = Number(count?.total ?? 0);
  const pages = Math.max(1, Math.ceil(total / 24));
  const requestedPage = firstValue(input.pagina);
  const page = Math.max(
    1,
    Math.min(pages, /^\d{1,6}$/.test(requestedPage) ? Number(requestedPage) : 1),
  );
  const rows = await many<ExperienceRow>(
    db,
    `${experienceCte} SELECT kind,id,name,city,slug,description,price_cents,company_name,category,uf,subtype,period,phone,email,address,source_website,editorial_website,languages,units,beds,summary,details,image_urls_json,source,editorial,bio FROM experience_candidates${where} ORDER BY CASE hub_normalize_label(city) WHEN 'maues' THEN 0 WHEN 'parintins' THEN 1 WHEN 'boavistadoramos' THEN 2 ELSE 3 END,hub_normalize_label(name),CASE kind WHEN 'tour' THEN 0 WHEN 'activity' THEN 1 WHEN 'provider' THEN 2 ELSE 3 END,id LIMIT ? OFFSET ?`,
    ...values,
    24,
    (page - 1) * 24,
  );
  const cities = [
    ...new Set([...regionCities, ...facetRows.map((row) => row.city).filter(Boolean)]),
  ].sort(
    (a, b) => experienceCityPriority(a) - experienceCityPriority(b) || a.localeCompare(b, "pt-BR"),
  );
  const results = experienceResultsFromRows(rows);
  return {
    results,
    total,
    page,
    pages,
    q,
    city,
    type,
    cities,
    hasCadasturProviders: Number(count?.has_cadastur_provider ?? 0) > 0,
  };
}
