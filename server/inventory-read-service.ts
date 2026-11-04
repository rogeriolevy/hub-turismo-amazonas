import type { DatabaseExecutor } from "../db/index.ts";
import { companyAccess, companyRole } from "./platform-access.ts";
import type { Actor, Company, Departure, Guide, OperationalRoom, Tour } from "./platform-models.ts";
import { emptyInventoryPage, type InventoryPage } from "./inventory-read-model.ts";
import { companyRoomsPage } from "./inventory-room-read-service.ts";
import {
  companyDeparturesPage,
  companyGuideDeparturesPage,
  companyGuidesPage,
  companyToursPage,
} from "./inventory-experience-read-service.ts";

export { companyInventory } from "./inventory-legacy-read-service.ts";
export { companyRoomSummary, companyRoomsPage } from "./inventory-room-read-service.ts";
export type { CompanyRoomSummary } from "./inventory-room-read-service.ts";
export type { InventoryPage } from "./inventory-read-model.ts";
export {
  companyDeparturesPage,
  companyGuideDeparturesPage,
  companyGuideOptions,
  companyGuidesPage,
  companyOperatorSummary,
  companyTourOptions,
  companyToursPage,
} from "./inventory-experience-read-service.ts";
export type { CompanyOperatorSummary } from "./inventory-experience-read-service.ts";

export function companyForPanel(
  db: DatabaseExecutor,
  actor: Actor,
  companyId: string,
  kind: Company["kind"],
) {
  return companyAccess(db, actor, companyId, kind);
}

export async function companyInventoryPage(
  db: DatabaseExecutor,
  actor: Actor,
  companyId: string,
  requestedPages: {
    rooms?: string | number;
    guides?: string | number;
    tours?: string | number;
    departures?: string | number;
  },
) {
  const company = await companyAccess(db, actor, companyId);
  const role = await companyRole(db, actor, companyId);
  if (company.kind === "operator" && role === "guide") {
    const departures = await companyGuideDeparturesPage(
      db,
      actor,
      companyId,
      requestedPages.departures,
    );
    const emptyRooms = emptyInventoryPage<OperationalRoom>();
    const emptyGuides = emptyInventoryPage<Guide>();
    const emptyTours = emptyInventoryPage<Tour>();
    const metadata = ({ page, pageSize, total, totalPages }: InventoryPage<unknown>) => ({
      page,
      pageSize,
      total,
      totalPages,
    });
    return {
      data: {
        company,
        rooms: emptyRooms.items,
        guides: emptyGuides.items,
        tours: emptyTours.items,
        departures: departures.items,
      },
      meta: {
        rooms: metadata(emptyRooms),
        guides: metadata(emptyGuides),
        tours: metadata(emptyTours),
        departures: metadata(departures),
      },
    };
  }
  const [rooms, guides, tours, departures] = await Promise.all([
    company.kind === "hotel"
      ? companyRoomsPage(db, actor, companyId, requestedPages.rooms)
      : Promise.resolve(emptyInventoryPage<OperationalRoom>()),
    company.kind === "operator"
      ? companyGuidesPage(db, actor, companyId, requestedPages.guides)
      : Promise.resolve(emptyInventoryPage<Guide>()),
    company.kind === "operator"
      ? companyToursPage(db, actor, companyId, requestedPages.tours)
      : Promise.resolve(emptyInventoryPage<Tour>()),
    company.kind === "operator"
      ? companyDeparturesPage(db, actor, companyId, requestedPages.departures)
      : Promise.resolve(emptyInventoryPage<Departure & { tour_name: string; reserved: number }>()),
  ]);
  const metadata = ({ page, pageSize, total, totalPages }: InventoryPage<unknown>) => ({
    page,
    pageSize,
    total,
    totalPages,
  });
  return {
    data: {
      company,
      rooms: rooms.items,
      guides: guides.items,
      tours: tours.items,
      departures: departures.items,
    },
    meta: {
      rooms: metadata(rooms),
      guides: metadata(guides),
      tours: metadata(tours),
      departures: metadata(departures),
    },
  };
}
