import type { DatabaseExecutor } from "../db/index.ts";
import { one } from "./platform-store.ts";
import { companyAccess } from "./platform-access.ts";
import type { Actor, OperationalRoom } from "./platform-models.ts";
import { inventoryPage } from "./inventory-read-model.ts";

export type CompanyRoomSummary = {
  ready: number;
  occupied: number;
  roomsToPrepare: number;
};

export async function companyRoomsPage(
  db: DatabaseExecutor,
  actor: Actor,
  companyId: string,
  requestedPage?: string | number,
) {
  await companyAccess(db, actor, companyId, "hotel", "hotel.read");
  return inventoryPage<OperationalRoom>(
    db,
    "SELECT COUNT(*) AS total FROM rooms WHERE company_id=?",
    `SELECT r.*,
      (SELECT b.customer_name FROM bookings b JOIN stay_records s ON s.booking_id=b.id
       WHERE b.room_id=r.id AND b.status='confirmed' AND s.checked_in_at IS NOT NULL AND s.checked_out_at IS NULL
       ORDER BY s.checked_in_at DESC,b.id DESC LIMIT 1) AS current_guest,
      (SELECT b.check_out FROM bookings b JOIN stay_records s ON s.booking_id=b.id
       WHERE b.room_id=r.id AND b.status='confirmed' AND s.checked_in_at IS NOT NULL AND s.checked_out_at IS NULL
       ORDER BY s.checked_in_at DESC,b.id DESC LIMIT 1) AS current_departure
     FROM rooms r WHERE r.company_id=? ORDER BY r.code,r.id LIMIT ? OFFSET ?`,
    companyId,
    requestedPage,
  );
}

export async function companyRoomSummary(
  db: DatabaseExecutor,
  actor: Actor,
  companyId: string,
): Promise<CompanyRoomSummary> {
  await companyAccess(db, actor, companyId, "hotel", "hotel.read");
  const row = await one<{
    ready: number;
    occupied: number;
    rooms_to_prepare: number;
  }>(
    db,
    `SELECT
      CAST(COALESCE(SUM(CASE WHEN r.operational_status='ready' AND NOT EXISTS (
        SELECT 1 FROM stay_records s JOIN bookings b ON b.id=s.booking_id
        WHERE b.room_id=r.id AND b.status='confirmed' AND s.checked_in_at IS NOT NULL AND s.checked_out_at IS NULL
      ) THEN 1 ELSE 0 END),0) AS INTEGER) AS ready,
      CAST(COALESCE(SUM(CASE WHEN EXISTS (
        SELECT 1 FROM stay_records s JOIN bookings b ON b.id=s.booking_id
        WHERE b.room_id=r.id AND b.status='confirmed' AND s.checked_in_at IS NOT NULL AND s.checked_out_at IS NULL
      ) THEN 1 ELSE 0 END),0) AS INTEGER) AS occupied,
      CAST(COALESCE(SUM(CASE WHEN r.operational_status IN ('cleaning','maintenance') THEN 1 ELSE 0 END),0) AS INTEGER) AS rooms_to_prepare
       FROM rooms r WHERE r.company_id=?`,
    companyId,
  );
  return {
    ready: row?.ready ?? 0,
    occupied: row?.occupied ?? 0,
    roomsToPrepare: row?.rooms_to_prepare ?? 0,
  };
}
