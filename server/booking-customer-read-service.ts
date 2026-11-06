import type { DatabaseExecutor } from "../db/index.ts";
import { many, one } from "./platform-store.ts";
import type { Actor, Booking } from "./platform-models.ts";
import { bookingQuery } from "./booking-query.ts";
import { pagedBookings } from "./booking-read-model.ts";

export function myBookings(db: DatabaseExecutor, actor: Actor) {
  return many<Booking>(
    db,
    bookingQuery + " WHERE b.user_id=? ORDER BY b.created_at DESC,b.id DESC",
    actor.id,
  );
}

export function myBookingsPage(
  db: DatabaseExecutor,
  actor: Actor,
  page?: string | number,
  includeHistory = false,
  bookingId?: string,
) {
  return pagedBookings(
    db,
    bookingId ? "b.user_id=? AND b.id=?" : "b.user_id=?",
    bookingId ? [actor.id, bookingId] : [actor.id],
    page,
    includeHistory,
  );
}

export async function myBookingSummary(db: DatabaseExecutor, actor: Actor) {
  const row = await one<{ total: number; pending: number }>(
    db,
    `SELECT CAST(COUNT(*) AS INTEGER) AS total,
            CAST(COALESCE(SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END),0) AS INTEGER) AS pending
       FROM bookings WHERE user_id=?`,
    actor.id,
  );
  return { total: row?.total ?? 0, pending: row?.pending ?? 0 };
}
