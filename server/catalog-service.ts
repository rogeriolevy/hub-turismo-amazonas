import type { DatabaseExecutor } from "../db/index.ts";
import { catalogCategories } from "../lib/catalog-content.ts";
import { publicCatalogItems } from "./catalog-content-service.ts";
import { one, many } from "./platform-store.ts";
import type { Company, Room, Tour, Guide, Departure } from "./platform-models.ts";

export async function publicCatalogPaths(db: DatabaseExecutor) {
  const [hotels, tours, guides, catalogPaths] = await Promise.all([
    publicHotels(db),
    publicTours(db),
    many<{ slug: string }>(
      db,
      "SELECT g.slug FROM guides g JOIN companies c ON c.id=g.company_id WHERE g.published=1 AND c.status='published'",
    ),
    Promise.all(
      catalogCategories.map(async (category) =>
        (await publicCatalogItems(db, category)).map((item) => "/prestadores/" + item.id),
      ),
    ),
  ]);
  return [
    ...hotels.map((item) => "/hospedagens/" + item.slug),
    ...tours.map((item) => "/passeios/" + item.slug),
    ...guides.map((item) => "/guias/" + item.slug),
    ...catalogPaths.flat(),
  ];
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
