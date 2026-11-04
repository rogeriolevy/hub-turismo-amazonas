import type { DatabaseExecutor } from "../db/index.ts";
import { many, one } from "./platform-store.ts";
import { companyAccess, companyMember } from "./platform-access.ts";
import { HttpError } from "./http.ts";
import type { Actor, Departure, Guide, Tour } from "./platform-models.ts";
import { inventoryPage } from "./inventory-read-model.ts";

export type CompanyOperatorSummary = {
  tours: number;
  guides: number;
};

export async function companyGuidesPage(
  db: DatabaseExecutor,
  actor: Actor,
  companyId: string,
  requestedPage?: string | number,
) {
  await companyAccess(db, actor, companyId, "operator", "operator.catalog.manage");
  return inventoryPage<Guide>(
    db,
    "SELECT COUNT(*) AS total FROM guides WHERE company_id=?",
    "SELECT * FROM guides WHERE company_id=? ORDER BY name,id LIMIT ? OFFSET ?",
    companyId,
    requestedPage,
  );
}

export async function companyGuideOptions(db: DatabaseExecutor, actor: Actor, companyId: string) {
  await companyAccess(db, actor, companyId, "operator", "operator.catalog.manage");
  return many<Pick<Guide, "id" | "name">>(
    db,
    "SELECT id,name FROM guides WHERE company_id=? ORDER BY name,id",
    companyId,
  );
}

export async function companyToursPage(
  db: DatabaseExecutor,
  actor: Actor,
  companyId: string,
  requestedPage?: string | number,
) {
  await companyAccess(db, actor, companyId, "operator", "operator.catalog.manage");
  return inventoryPage<Tour>(
    db,
    "SELECT COUNT(*) AS total FROM tours WHERE company_id=?",
    "SELECT * FROM tours WHERE company_id=? ORDER BY name,id LIMIT ? OFFSET ?",
    companyId,
    requestedPage,
  );
}

export async function companyTourOptions(db: DatabaseExecutor, actor: Actor, companyId: string) {
  await companyAccess(db, actor, companyId, "operator", "operator.schedule.manage");
  return many<Pick<Tour, "id" | "name">>(
    db,
    "SELECT id,name FROM tours WHERE company_id=? ORDER BY name,id",
    companyId,
  );
}

export async function companyDeparturesPage(
  db: DatabaseExecutor,
  actor: Actor,
  companyId: string,
  requestedPage?: string | number,
) {
  await companyAccess(db, actor, companyId, "operator", "operator.schedule.manage");
  return inventoryPage<Departure & { tour_name: string }>(
    db,
    "SELECT COUNT(*) AS total FROM departures d JOIN tours t ON t.id=d.tour_id WHERE t.company_id=?",
    `SELECT d.*,t.name tour_name,
      CAST(COALESCE((SELECT SUM(b.guests) FROM bookings b WHERE b.departure_id=d.id AND b.status='confirmed'),0) AS INTEGER) reserved
       FROM departures d JOIN tours t ON t.id=d.tour_id WHERE t.company_id=?
      ORDER BY d.starts_at DESC,d.id DESC LIMIT ? OFFSET ?`,
    companyId,
    requestedPage,
  );
}

export async function companyGuideDeparturesPage(
  db: DatabaseExecutor,
  actor: Actor,
  companyId: string,
  requestedPage?: string | number,
) {
  await companyAccess(db, actor, companyId, "operator", "operator.schedule.own.read");
  const member = await companyMember(db, actor, companyId);
  if (!member?.guide_id)
    throw new HttpError(403, "FORBIDDEN", "A conta não está vinculada a um cadastro de guia.");
  return inventoryPage<Departure & { tour_name: string }>(
    db,
    "SELECT COUNT(*) AS total FROM departures d JOIN tours t ON t.id=d.tour_id WHERE t.company_id=? AND t.guide_id=?",
    `SELECT d.*,t.name tour_name,
      CAST(COALESCE((SELECT SUM(b.guests) FROM bookings b WHERE b.departure_id=d.id AND b.status='confirmed'),0) AS INTEGER) reserved
       FROM departures d JOIN tours t ON t.id=d.tour_id WHERE t.company_id=? AND t.guide_id=?
      ORDER BY d.starts_at DESC,d.id DESC LIMIT ? OFFSET ?`,
    companyId,
    requestedPage,
    [member.guide_id],
  );
}

export async function companyOperatorSummary(
  db: DatabaseExecutor,
  actor: Actor,
  companyId: string,
): Promise<CompanyOperatorSummary> {
  await companyAccess(db, actor, companyId, "operator", "operator.catalog.manage");
  const row = await one<{ tours: number; guides: number }>(
    db,
    `SELECT
      (SELECT CAST(COUNT(*) AS INTEGER) FROM tours WHERE company_id=?) AS tours,
      (SELECT CAST(COUNT(*) AS INTEGER) FROM guides WHERE company_id=?) AS guides`,
    companyId,
    companyId,
  );
  return { tours: row?.tours ?? 0, guides: row?.guides ?? 0 };
}
