import type Database from "better-sqlite3";
import { one, many } from "./platform-store.ts";
import type { Company, Room, Tour, Guide, Departure } from "./platform-models.ts";
export function publicCatalogPaths(db: Database.Database) {
  return [
    ...publicHotels(db).map((item) => "/hospedagens/" + item.slug),
    ...publicTours(db).map((item) => "/passeios/" + item.slug),
    ...many<{ slug: string }>(
      db,
      "SELECT g.slug FROM guides g JOIN companies c ON c.id=g.company_id WHERE g.published=1 AND c.status='published'",
    ).map((item) => "/guias/" + item.slug),
  ];
}
export function publicHotels(db: Database.Database, search = "") {
  const query = search.trim().slice(0, 100);
  return many<Company & { from_price: number | null }>(
    db,
    "SELECT c.*,(SELECT MIN(price_cents) FROM rooms r WHERE r.company_id=c.id AND r.active=1) from_price FROM companies c WHERE c.kind='hotel' AND c.status='published' AND (c.name LIKE ? OR c.city LIKE ?) ORDER BY c.name",
    "%" + query + "%",
    "%" + query + "%",
  );
}
export function publicHotel(db: Database.Database, slug: string) {
  const company = one<Company>(
    db,
    "SELECT * FROM companies WHERE slug=? AND kind='hotel' AND status='published'",
    slug,
  );
  return company
    ? {
        ...company,
        rooms: many<Room>(
          db,
          "SELECT * FROM rooms WHERE company_id=? AND active=1 ORDER BY price_cents,code",
          company.id,
        ),
      }
    : null;
}
export function publicTours(db: Database.Database, search = "") {
  const query = search.trim().slice(0, 100);
  return many<Tour & { company_name: string }>(
    db,
    "SELECT t.*,c.name company_name FROM tours t JOIN companies c ON c.id=t.company_id WHERE t.published=1 AND c.status='published' AND (t.name LIKE ? OR t.city LIKE ?) ORDER BY t.name",
    "%" + query + "%",
    "%" + query + "%",
  );
}
export function publicTour(db: Database.Database, slug: string) {
  const tour = one<Tour & { company_name: string }>(
    db,
    "SELECT t.*,c.name company_name FROM tours t JOIN companies c ON c.id=t.company_id WHERE t.slug=? AND t.published=1 AND c.status='published'",
    slug,
  );
  if (!tour) return null;
  return {
    ...tour,
    guide: tour.guide_id
      ? one<Guide>(db, "SELECT * FROM guides WHERE id=? AND published=1", tour.guide_id)
      : null,
    departures: many<Departure>(
      db,
      "SELECT d.*,COALESCE((SELECT SUM(guests) FROM bookings b WHERE b.departure_id=d.id AND b.status='confirmed'),0) reserved FROM departures d WHERE d.tour_id=? AND d.active=1 AND d.starts_at>? ORDER BY d.starts_at",
      tour.id,
      new Date().toISOString(),
    ),
  };
}
export function publicGuide(db: Database.Database, slug: string) {
  const guide = one<Guide & { company_name: string; city: string }>(
    db,
    "SELECT g.*,c.name company_name,c.city FROM guides g JOIN companies c ON c.id=g.company_id WHERE g.slug=? AND g.published=1 AND c.status='published'",
    slug,
  );
  return guide
    ? {
        ...guide,
        tours: many<Tour>(db, "SELECT * FROM tours WHERE guide_id=? AND published=1", guide.id),
      }
    : null;
}
