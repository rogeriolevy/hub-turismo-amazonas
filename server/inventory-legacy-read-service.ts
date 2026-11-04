import type { DatabaseExecutor } from "../db/index.ts";
import { many } from "./platform-store.ts";
import { companyAccess, companyMember, companyRole } from "./platform-access.ts";
import { HttpError } from "./http.ts";
import type { Actor, Departure, Guide, OperationalRoom, Tour } from "./platform-models.ts";

export async function companyInventory(db: DatabaseExecutor, actor: Actor, companyId: string) {
  const company = await companyAccess(db, actor, companyId);
  const role = await companyRole(db, actor, companyId);
  if (company.kind === "operator" && role === "guide") {
    await companyAccess(db, actor, companyId, "operator", "operator.schedule.own.read");
    const member = await companyMember(db, actor, companyId);
    if (!member?.guide_id)
      throw new HttpError(403, "FORBIDDEN", "A conta não está vinculada a um cadastro de guia.");
    const departures = await many<Departure & { tour_name: string }>(
      db,
      "SELECT d.*,t.name tour_name,CAST(COALESCE((SELECT SUM(b.guests) FROM bookings b WHERE b.departure_id=d.id AND b.status='confirmed'),0) AS INTEGER) reserved FROM departures d JOIN tours t ON t.id=d.tour_id WHERE t.company_id=? AND t.guide_id=? ORDER BY d.starts_at DESC,d.id DESC",
      companyId,
      member.guide_id,
    );
    return { company, rooms: [], guides: [], tours: [], departures };
  }
  const [rooms, guides, tours, departures] = await Promise.all([
    many<OperationalRoom>(
      db,
      `SELECT r.*,
        (SELECT b.customer_name FROM bookings b JOIN stay_records s ON s.booking_id=b.id
         WHERE b.room_id=r.id AND b.status='confirmed' AND s.checked_in_at IS NOT NULL AND s.checked_out_at IS NULL
         ORDER BY s.checked_in_at DESC LIMIT 1) AS current_guest,
        (SELECT b.check_out FROM bookings b JOIN stay_records s ON s.booking_id=b.id
         WHERE b.room_id=r.id AND b.status='confirmed' AND s.checked_in_at IS NOT NULL AND s.checked_out_at IS NULL
         ORDER BY s.checked_in_at DESC LIMIT 1) AS current_departure
       FROM rooms r WHERE r.company_id=? ORDER BY r.code`,
      companyId,
    ),
    many<Guide>(db, "SELECT * FROM guides WHERE company_id=? ORDER BY name", companyId),
    many<Tour>(db, "SELECT * FROM tours WHERE company_id=? ORDER BY name", companyId),
    many<Departure & { tour_name: string }>(
      db,
      "SELECT d.*,t.name tour_name,CAST(COALESCE((SELECT SUM(b.guests) FROM bookings b WHERE b.departure_id=d.id AND b.status='confirmed'),0) AS INTEGER) reserved FROM departures d JOIN tours t ON t.id=d.tour_id WHERE t.company_id=? ORDER BY d.starts_at DESC",
      companyId,
    ),
  ]);
  return { company, rooms, guides, tours, departures };
}
