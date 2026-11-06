import type { DatabaseExecutor } from "../db/index.ts";
import type { PanelArea } from "../lib/platform-navigation.ts";
import type { Actor } from "./platform-models.ts";
import {
  businessAttentionBookings,
  businessBookingSummary,
  businessBookingsPage,
  businessStayBookingsPage,
} from "./booking-read-service.ts";
import {
  companyDeparturesPage,
  companyGuideOptions,
  companyGuidesPage,
  companyOperatorSummary,
  companyRoomSummary,
  companyRoomsPage,
  companyTourOptions,
  companyToursPage,
} from "./inventory-read-service.ts";

type BusinessPanelArea = Extract<PanelArea, "hotel" | "passeios">;

type BusinessPanelQuery = {
  page?: string;
  roomPage?: string;
  tourPage?: string;
  guidePage?: string;
  departurePage?: string;
  bookingId?: string;
};

export async function businessPanelReadData(
  db: DatabaseExecutor,
  actor: Actor,
  area: BusinessPanelArea,
  section: string,
  companyId: string,
  query: BusinessPanelQuery,
) {
  const expectedKind = area === "hotel" ? "hotel" : "operator";
  const [
    bookingPage,
    stayPage,
    bookingSummary,
    attentionBookings,
    roomsPage,
    roomSummary,
    guidesPage,
    guideOptions,
    toursPage,
    tourOptions,
    departuresPage,
    operatorSummary,
  ] = await Promise.all([
    section === "reservas" || section === "vagas"
      ? businessBookingsPage(db, actor, companyId, query.page, true, query.bookingId)
      : Promise.resolve(undefined),
    section === "fnrh"
      ? businessStayBookingsPage(db, actor, companyId, query.page)
      : Promise.resolve(undefined),
    section === "" ? businessBookingSummary(db, actor, companyId) : Promise.resolve(undefined),
    section === ""
      ? businessAttentionBookings(db, actor, companyId, expectedKind)
      : Promise.resolve([]),
    area === "hotel" && (section === "quartos" || section === "")
      ? companyRoomsPage(db, actor, companyId, query.roomPage)
      : Promise.resolve(undefined),
    area === "hotel" && section === ""
      ? companyRoomSummary(db, actor, companyId)
      : Promise.resolve(undefined),
    area === "passeios" && section === "experiencias"
      ? companyGuidesPage(db, actor, companyId, query.guidePage)
      : Promise.resolve(undefined),
    area === "passeios" && section === "experiencias"
      ? companyGuideOptions(db, actor, companyId)
      : Promise.resolve([]),
    area === "passeios" && section === "experiencias"
      ? companyToursPage(db, actor, companyId, query.tourPage)
      : Promise.resolve(undefined),
    area === "passeios" && section === "agenda"
      ? companyTourOptions(db, actor, companyId)
      : Promise.resolve([]),
    area === "passeios" && (section === "agenda" || section === "vagas")
      ? companyDeparturesPage(db, actor, companyId, query.departurePage)
      : Promise.resolve(undefined),
    area === "passeios" && section === ""
      ? companyOperatorSummary(db, actor, companyId)
      : Promise.resolve(undefined),
  ]);

  return {
    bookingPage,
    stayPage,
    bookingSummary,
    attentionBookings,
    roomsPage,
    roomSummary,
    guidesPage,
    guideOptions,
    toursPage,
    tourOptions,
    departuresPage,
    operatorSummary,
  };
}
