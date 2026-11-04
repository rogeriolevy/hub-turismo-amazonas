import type { DatabaseExecutor } from "../db/index.ts";
import { many } from "./platform-store.ts";

export { publicHotel, publicHotels, searchPublicHotels } from "./catalog-hotel-read-service.ts";
export {
  publicGuide,
  publicGuides,
  publicTour,
  publicTours,
  searchPublicTours,
} from "./catalog-experience-read-service.ts";

export async function publicCatalogPaths(db: DatabaseExecutor) {
  const [hotels, tours, guides, catalogPaths] = await Promise.all([
    many<{ slug: string }>(
      db,
      "SELECT slug FROM companies WHERE kind='hotel' AND status='published'",
    ),
    many<{ slug: string }>(
      db,
      "SELECT t.slug FROM tours t JOIN companies c ON c.id=t.company_id WHERE t.published=1 AND c.status='published'",
    ),
    many<{ slug: string }>(
      db,
      "SELECT g.slug FROM guides g JOIN companies c ON c.id=g.company_id WHERE g.published=1 AND c.status='published'",
    ),
    many<{ id: string }>(
      db,
      "SELECT id FROM catalog_items WHERE status='published' AND source_entry_id IS NULL",
    ),
  ]);
  return [
    ...hotels.map((item) => "/hospedagens/" + item.slug),
    ...tours.map((item) => "/passeios/" + item.slug),
    ...guides.map((item) => "/guias/" + item.slug),
    ...catalogPaths.map((item) => "/prestadores/" + item.id),
  ];
}
