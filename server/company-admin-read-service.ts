import type { DatabaseExecutor } from "../db/index.ts";
import { z } from "zod";
import { one, many, parse } from "./platform-store.ts";
import { requirePlatformAdmin } from "./platform-access.ts";
import type { Actor } from "./platform-models.ts";

const GUIDE_OPTION_PAGE_SIZE = 20;

const guideOptionsInput = z.object({
  q: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  selectedId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
});

export async function guideOptionsPage(db: DatabaseExecutor, actor: Actor, input: unknown) {
  requirePlatformAdmin(actor);
  const { q, page: requestedPage, selectedId, companyId } = parse(guideOptionsInput, input);
  const filter = `%${q.replace(/[\\%_]/g, "\\$&").toLowerCase()}%`;
  const joins = " FROM guides g JOIN companies c ON c.id=g.company_id";
  const search =
    " WHERE (LOWER(g.name) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(NULLIF(TRIM(c.trade_name),''),c.name)) LIKE ? ESCAPE '\\' OR LOWER(c.city) LIKE ? ESCAPE '\\')" +
    (companyId ? " AND g.company_id=?" : "");
  const searchValues = companyId ? [filter, filter, filter, companyId] : [filter, filter, filter];
  const count = await one<{ total: number | string }>(
    db,
    `SELECT COUNT(*) AS total${joins}${search}`,
    ...searchValues,
  );
  const total = Number(count?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / GUIDE_OPTION_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const [items, selectedRows] = await Promise.all([
    many<{ value: string; label: string }>(
      db,
      `SELECT g.id AS value,g.name AS label${joins}${search} ORDER BY LOWER(g.name),g.id LIMIT ? OFFSET ?`,
      ...searchValues,
      GUIDE_OPTION_PAGE_SIZE,
      (page - 1) * GUIDE_OPTION_PAGE_SIZE,
    ),
    selectedId
      ? many<{ value: string; label: string }>(
          db,
          `SELECT g.id AS value,g.name AS label${joins} WHERE g.id=?${companyId ? " AND g.company_id=?" : ""} LIMIT 1`,
          selectedId,
          ...(companyId ? [companyId] : []),
        )
      : Promise.resolve([] as { value: string; label: string }[]),
  ]);
  return {
    items,
    selected: selectedRows[0] ?? null,
    page,
    pageSize: GUIDE_OPTION_PAGE_SIZE,
    total,
    totalPages,
  };
}

export async function companyCounts(db: DatabaseExecutor, actor: Actor) {
  requirePlatformAdmin(actor);
  const result = await one<{
    total: number | string;
    published: number | string | null;
  }>(
    db,
    "SELECT COUNT(*) AS total, SUM(CASE WHEN status='published' THEN 1 ELSE 0 END) AS published FROM companies",
  );
  return { total: Number(result?.total ?? 0), published: Number(result?.published ?? 0) };
}
