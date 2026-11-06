import { z } from "zod";
import type { DatabaseExecutor } from "../db/index.ts";
import { one, many, parse } from "./platform-store.ts";
import { isPlatformAdmin } from "./platform-authorization.ts";
import type { Actor, Company } from "./platform-models.ts";

const COMPANY_PAGE_SIZE = 20;

export type CompaniesPage = {
  items: Company[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export async function companiesFor(db: DatabaseExecutor, actor: Actor) {
  return isPlatformAdmin(actor)
    ? await many<Company>(
        db,
        "SELECT * FROM companies ORDER BY COALESCE(NULLIF(TRIM(trade_name),''),name),id",
      )
    : await many<Company>(
        db,
        "SELECT c.* FROM companies c JOIN company_members m ON m.company_id=c.id WHERE m.user_id=? AND c.status!='suspended' ORDER BY COALESCE(NULLIF(TRIM(c.trade_name),''),c.name),c.id",
        actor.id,
      );
}

export async function companiesPageFor(
  db: DatabaseExecutor,
  actor: Actor,
  requestedPage?: string | number,
): Promise<CompaniesPage> {
  const isAdmin = isPlatformAdmin(actor);
  const count = isAdmin
    ? await one<{ total: number | string }>(db, "SELECT COUNT(*) AS total FROM companies")
    : await one<{ total: number | string }>(
        db,
        "SELECT COUNT(*) AS total FROM companies c JOIN company_members m ON m.company_id=c.id WHERE m.user_id=? AND c.status!='suspended'",
        actor.id,
      );
  const total = Number(count?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / COMPANY_PAGE_SIZE));
  const requested = Number(requestedPage ?? 1);
  const safePage = Number.isSafeInteger(requested) && requested > 0 ? requested : 1;
  const page = Math.min(safePage, totalPages);
  const items = isAdmin
    ? await many<Company>(
        db,
        "SELECT * FROM companies ORDER BY COALESCE(NULLIF(TRIM(trade_name),''),name),id LIMIT ? OFFSET ?",
        COMPANY_PAGE_SIZE,
        (page - 1) * COMPANY_PAGE_SIZE,
      )
    : await many<Company>(
        db,
        "SELECT c.* FROM companies c JOIN company_members m ON m.company_id=c.id WHERE m.user_id=? AND c.status!='suspended' ORDER BY COALESCE(NULLIF(TRIM(c.trade_name),''),c.name),c.id LIMIT ? OFFSET ?",
        actor.id,
        COMPANY_PAGE_SIZE,
        (page - 1) * COMPANY_PAGE_SIZE,
      );
  return { items, page, pageSize: COMPANY_PAGE_SIZE, total, totalPages };
}

export async function firstCompanyForKind(
  db: DatabaseExecutor,
  actor: Actor,
  kind: Company["kind"],
) {
  const isAdmin = isPlatformAdmin(actor);
  return one<{ id: string }>(
    db,
    isAdmin
      ? "SELECT id FROM companies WHERE kind=? ORDER BY COALESCE(NULLIF(TRIM(trade_name),''),name),id LIMIT 1"
      : "SELECT c.id FROM companies c JOIN company_members m ON m.company_id=c.id WHERE m.user_id=? AND c.status!='suspended' AND c.kind=? ORDER BY COALESCE(NULLIF(TRIM(c.trade_name),''),c.name),c.id LIMIT 1",
    ...(isAdmin ? [kind] : [actor.id, kind]),
  );
}

const companyOptionsInput = z.object({
  q: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  selectedId: z.string().uuid().optional(),
  kind: z.enum(["hotel", "operator"]).optional(),
});

export async function companyOptionsPage(db: DatabaseExecutor, actor: Actor, input: unknown) {
  const { q, page: requestedPage, selectedId, kind } = parse(companyOptionsInput, input);
  const isAdmin = isPlatformAdmin(actor);
  const membershipJoin = isAdmin ? "" : " JOIN company_members m ON m.company_id=c.id";
  const membershipFilter = isAdmin ? "" : " AND m.user_id=? AND c.status!='suspended'";
  const scopeValues = isAdmin ? [] : [actor.id];
  const kindFilter = kind ? " AND c.kind=?" : "";
  const kindValues = kind ? [kind] : [];
  const filter = `%${q.replace(/[\\%_]/g, "\\$&").toLowerCase()}%`;
  const searchable =
    " AND (LOWER(COALESCE(NULLIF(TRIM(c.trade_name),''),c.name)) LIKE ? ESCAPE '\\' OR LOWER(c.city) LIKE ? ESCAPE '\\')";
  const count = await one<{ total: number | string }>(
    db,
    `SELECT COUNT(*) AS total FROM companies c${membershipJoin} WHERE 1=1${membershipFilter}${kindFilter}${searchable}`,
    ...scopeValues,
    ...kindValues,
    filter,
    filter,
  );
  const total = Number(count?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / COMPANY_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const [items, selectedRows] = await Promise.all([
    many<{ value: string; label: string }>(
      db,
      `SELECT c.id AS value,COALESCE(NULLIF(TRIM(c.trade_name),''),c.name) AS label FROM companies c${membershipJoin} WHERE 1=1${membershipFilter}${kindFilter}${searchable} ORDER BY LOWER(COALESCE(NULLIF(TRIM(c.trade_name),''),c.name)),c.id LIMIT ? OFFSET ?`,
      ...scopeValues,
      ...kindValues,
      filter,
      filter,
      COMPANY_PAGE_SIZE,
      (page - 1) * COMPANY_PAGE_SIZE,
    ),
    selectedId
      ? many<{ value: string; label: string }>(
          db,
          `SELECT c.id AS value,COALESCE(NULLIF(TRIM(c.trade_name),''),c.name) AS label FROM companies c${membershipJoin} WHERE c.id=?${membershipFilter}${kindFilter} LIMIT 1`,
          selectedId,
          ...scopeValues,
          ...kindValues,
        )
      : Promise.resolve([] as { value: string; label: string }[]),
  ]);
  return {
    items,
    selected: selectedRows[0] ?? null,
    page,
    pageSize: COMPANY_PAGE_SIZE,
    total,
    totalPages,
  };
}
