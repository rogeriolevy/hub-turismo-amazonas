import type { DatabaseExecutor } from "../db/index.ts";
import { todayInManaus } from "../lib/platform-schema/format.ts";
import { many, one } from "./platform-store.ts";
import { companyAccess } from "./platform-access.ts";
import type { Actor, Booking } from "./platform-models.ts";
import { bookingQuery } from "./booking-query.ts";
import { pagedBookings, type BusinessBookingSummary } from "./booking-read-model.ts";

export async function businessBookings(db: DatabaseExecutor, actor: Actor, companyId: string) {
  const company = await companyAccess(db, actor, companyId);
  await companyAccess(
    db,
    actor,
    companyId,
    company.kind,
    company.kind === "hotel" ? "hotel.bookings.manage" : "operator.bookings.manage",
  );
  return many<Booking>(
    db,
    bookingQuery + " WHERE b.company_id=? ORDER BY b.created_at DESC,b.id DESC",
    companyId,
  );
}

export async function businessBookingsPage(
  db: DatabaseExecutor,
  actor: Actor,
  companyId: string,
  page?: string | number,
  includeHistory = false,
  bookingId?: string,
) {
  const company = await companyAccess(db, actor, companyId);
  await companyAccess(
    db,
    actor,
    companyId,
    company.kind,
    company.kind === "hotel" ? "hotel.bookings.manage" : "operator.bookings.manage",
  );
  return pagedBookings(
    db,
    bookingId ? "b.company_id=? AND b.id=?" : "b.company_id=?",
    bookingId ? [companyId, bookingId] : [companyId],
    page,
    includeHistory,
  );
}

export async function businessStayBookingsPage(
  db: DatabaseExecutor,
  actor: Actor,
  companyId: string,
  page?: string | number,
) {
  await companyAccess(db, actor, companyId, "hotel", "hotel.stays.manage");
  return pagedBookings(
    db,
    "b.company_id=? AND b.kind='hotel' AND b.status='confirmed'",
    [companyId],
    page,
  );
}

export async function businessBookingSummary(
  db: DatabaseExecutor,
  actor: Actor,
  companyId: string,
): Promise<BusinessBookingSummary> {
  const company = await companyAccess(db, actor, companyId);
  await companyAccess(
    db,
    actor,
    companyId,
    company.kind,
    company.kind === "hotel" ? "hotel.read" : "operator.bookings.manage",
  );
  const today = todayInManaus();
  const row = await one<BusinessBookingSummary>(
    db,
    `SELECT
      CAST(COALESCE(SUM(CASE WHEN b.status='pending' THEN 1 ELSE 0 END),0) AS INTEGER) AS pending,
      CAST(COALESCE(SUM(CASE WHEN b.status='confirmed' THEN 1 ELSE 0 END),0) AS INTEGER) AS confirmed,
      CAST(COALESCE(SUM(CASE WHEN b.status='confirmed' AND b.kind='hotel' AND b.check_in=? AND s.checked_in_at IS NULL THEN 1 ELSE 0 END),0) AS INTEGER) AS arrivals,
      CAST(COALESCE(SUM(CASE WHEN b.status='confirmed' AND b.kind='hotel' AND b.check_out=? AND s.checked_out_at IS NULL THEN 1 ELSE 0 END),0) AS INTEGER) AS departures,
      CAST(COALESCE(SUM(CASE WHEN b.status='confirmed' AND s.checked_in_at IS NOT NULL AND s.checked_out_at IS NULL THEN 1 ELSE 0 END),0) AS INTEGER) AS occupied
       FROM bookings b LEFT JOIN stay_records s ON s.booking_id=b.id
      WHERE b.company_id=?`,
    today,
    today,
    companyId,
  );
  return {
    pending: row?.pending ?? 0,
    confirmed: row?.confirmed ?? 0,
    arrivals: row?.arrivals ?? 0,
    departures: row?.departures ?? 0,
    occupied: row?.occupied ?? 0,
  };
}

export async function businessAttentionBookings(
  db: DatabaseExecutor,
  actor: Actor,
  companyId: string,
  kind: "hotel" | "operator",
) {
  await companyAccess(
    db,
    actor,
    companyId,
    kind,
    kind === "hotel" ? "hotel.read" : "operator.bookings.manage",
  );
  const condition =
    kind === "hotel"
      ? "(b.status='pending' OR (b.status='confirmed' AND ((s.checked_in_at IS NOT NULL AND s.checked_out_at IS NULL) OR (b.kind='hotel' AND b.check_in=? AND s.checked_in_at IS NULL))))"
      : "b.status='pending'";
  const values = kind === "hotel" ? [companyId, todayInManaus(), 5] : [companyId, 5];
  return many<Booking>(
    db,
    bookingQuery +
      ` WHERE b.company_id=? AND ${condition} ORDER BY b.created_at DESC,b.id DESC LIMIT ?`,
    ...values,
  );
}
