import type { DatabaseExecutor } from "../db/index.ts";
import { normalizeLabel } from "../lib/normalize-label.ts";
import { many, one } from "./platform-store.ts";
import type { Departure, Guide, Tour } from "./platform-models.ts";
import {
  boundedPage,
  firstSearchValue,
  PUBLIC_CATALOG_API_PAGE_SIZE,
} from "./catalog-read-model.ts";

export async function searchPublicTours(
  db: DatabaseExecutor,
  input: { q?: string | string[]; page?: string | string[] } = {},
) {
  const query = normalizeLabel(firstSearchValue(input.q));
  const values: unknown[] = [];
  let where = " WHERE t.published=1 AND c.status='published'";
  if (query) {
    where += " AND (hub_normalize_label(t.name) LIKE ? OR hub_normalize_label(t.city) LIKE ?)";
    values.push(`%${query}%`, `%${query}%`);
  }
  const count = await one<{ total: number | string }>(
    db,
    "SELECT COUNT(*) AS total FROM tours t JOIN companies c ON c.id=t.company_id" + where,
    ...values,
  );
  const total = Number(count?.total ?? 0);
  const pages = Math.max(1, Math.ceil(total / PUBLIC_CATALOG_API_PAGE_SIZE));
  const page = boundedPage(firstSearchValue(input.page), pages);
  const tours = await many<Tour & { company_name: string }>(
    db,
    "SELECT t.*,COALESCE(NULLIF(TRIM(c.trade_name),''),c.name) company_name FROM tours t JOIN companies c ON c.id=t.company_id" +
      where +
      " ORDER BY t.name,t.id LIMIT ? OFFSET ?",
    ...values,
    PUBLIC_CATALOG_API_PAGE_SIZE,
    (page - 1) * PUBLIC_CATALOG_API_PAGE_SIZE,
  );
  return { tours, total, page, pages, pageSize: PUBLIC_CATALOG_API_PAGE_SIZE };
}

export async function publicTours(db: DatabaseExecutor, search = "") {
  const query = search.trim().slice(0, 100);
  return many<Tour & { company_name: string }>(
    db,
    "SELECT t.*,COALESCE(NULLIF(TRIM(c.trade_name),''),c.name) company_name FROM tours t JOIN companies c ON c.id=t.company_id WHERE t.published=1 AND c.status='published' AND (t.name LIKE ? OR t.city LIKE ?) ORDER BY t.name",
    "%" + query + "%",
    "%" + query + "%",
  );
}

export async function publicTour(db: DatabaseExecutor, slug: string) {
  const tour = await one<Tour & { company_name: string }>(
    db,
    "SELECT t.*,COALESCE(NULLIF(TRIM(c.trade_name),''),c.name) company_name FROM tours t JOIN companies c ON c.id=t.company_id WHERE t.slug=? AND t.published=1 AND c.status='published'",
    slug,
  );
  if (!tour) return null;
  const [guide, departures] = await Promise.all([
    tour.guide_id
      ? one<Guide>(db, "SELECT * FROM guides WHERE id=? AND published=1", tour.guide_id)
      : null,
    many<Departure>(
      db,
      "SELECT d.*,CAST(COALESCE((SELECT SUM(guests) FROM bookings b WHERE b.departure_id=d.id AND b.status='confirmed'),0) AS INTEGER) reserved FROM departures d WHERE d.tour_id=? AND d.active=1 AND d.starts_at>? ORDER BY d.starts_at",
      tour.id,
      new Date().toISOString(),
    ),
  ]);
  return { ...tour, guide, departures };
}

export async function publicGuide(db: DatabaseExecutor, slug: string) {
  const guide = await one<Guide & { company_name: string; city: string }>(
    db,
    "SELECT g.*,COALESCE(NULLIF(TRIM(c.trade_name),''),c.name) company_name,c.city FROM guides g JOIN companies c ON c.id=g.company_id WHERE g.slug=? AND g.published=1 AND c.status='published'",
    slug,
  );
  return guide
    ? {
        ...guide,
        tours: await many<Tour>(
          db,
          "SELECT * FROM tours WHERE guide_id=? AND published=1",
          guide.id,
        ),
      }
    : null;
}

export async function publicGuides(db: DatabaseExecutor) {
  return many<Guide & { company_name: string; city: string }>(
    db,
    "SELECT g.*,COALESCE(NULLIF(TRIM(c.trade_name),''),c.name) company_name,c.city FROM guides g JOIN companies c ON c.id=g.company_id WHERE g.published=1 AND c.status='published' ORDER BY g.name,g.id",
  );
}
