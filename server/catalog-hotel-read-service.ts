import type { DatabaseExecutor } from "../db/index.ts";
import { normalizeLabel } from "../lib/normalize-label.ts";
import { one, many } from "./platform-store.ts";
import type { Company, Room } from "./platform-models.ts";
import { boundedPage, firstSearchValue, PUBLIC_HOTEL_PAGE_SIZE } from "./catalog-read-model.ts";

export async function searchPublicHotels(
  db: DatabaseExecutor,
  input: { q?: string | string[]; city?: string | string[]; page?: string | string[] } = {},
  requestedPageSize = PUBLIC_HOTEL_PAGE_SIZE,
) {
  const pageSize =
    Number.isSafeInteger(requestedPageSize) && requestedPageSize > 0
      ? Math.min(100, requestedPageSize)
      : PUBLIC_HOTEL_PAGE_SIZE;
  const query = normalizeLabel(firstSearchValue(input.q));
  const city = normalizeLabel(firstSearchValue(input.city));
  const conditions = ["c.kind='hotel'", "c.status='published'"];
  const values: unknown[] = [];
  if (city) {
    conditions.push("hub_normalize_label(c.city)=?");
    values.push(city);
  }
  if (query) {
    conditions.push(
      "(hub_normalize_label(c.trade_name) LIKE ? OR hub_normalize_label(c.name) LIKE ? OR hub_normalize_label(c.city) LIKE ?)",
    );
    const pattern = "%" + query + "%";
    values.push(pattern, pattern, pattern);
  }
  const where = " WHERE " + conditions.join(" AND ");
  const count = await one<{ total: number | string }>(
    db,
    "SELECT COUNT(*) AS total FROM companies c" + where,
    ...values,
  );
  const total = Number(count?.total ?? 0);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = boundedPage(firstSearchValue(input.page), pages);
  const hotels = await many<Company & { from_price: number | null }>(
    db,
    "SELECT c.*,(SELECT MIN(price_cents) FROM rooms r WHERE r.company_id=c.id AND r.active=1 AND r.operational_status='ready') AS from_price FROM companies c" +
      where +
      " ORDER BY COALESCE(NULLIF(TRIM(c.trade_name),''),c.name),c.id LIMIT ? OFFSET ?",
    ...values,
    pageSize,
    (page - 1) * pageSize,
  );
  return { hotels, total, page, pages, pageSize };
}

export async function publicHotels(db: DatabaseExecutor, search = "") {
  const query = search.trim().slice(0, 100);
  return many<Company & { from_price: number | null }>(
    db,
    "SELECT c.*,(SELECT MIN(price_cents) FROM rooms r WHERE r.company_id=c.id AND r.active=1 AND r.operational_status='ready') from_price FROM companies c WHERE c.kind='hotel' AND c.status='published' AND (c.trade_name LIKE ? OR c.name LIKE ? OR c.city LIKE ?) ORDER BY COALESCE(NULLIF(TRIM(c.trade_name),''),c.name),c.id",
    "%" + query + "%",
    "%" + query + "%",
    "%" + query + "%",
  );
}

export async function publicHotel(db: DatabaseExecutor, slug: string) {
  const company = await one<Company>(
    db,
    "SELECT * FROM companies WHERE slug=? AND kind='hotel' AND status='published'",
    slug,
  );
  if (!company) return null;
  return {
    ...company,
    rooms: await many<Room>(
      db,
      "SELECT * FROM rooms WHERE company_id=? AND active=1 AND operational_status='ready' ORDER BY price_cents,code",
      company.id,
    ),
  };
}
