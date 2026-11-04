import type { DatabaseExecutor } from "../db/index.ts";
import { many, one } from "./platform-store.ts";
import type { Booking } from "./platform-models.ts";
import { bookingQuery } from "./booking-query.ts";

const BOOKING_PAGE_SIZE = 20;

export type BookingPage = {
  items: Booking[];
  historyByBookingId: Record<string, BookingHistoryEntry[]>;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type BookingHistoryEntry = {
  action: string;
  created_at: string;
};

export type BusinessBookingSummary = {
  pending: number;
  confirmed: number;
  arrivals: number;
  departures: number;
  occupied: number;
};

export async function pagedBookings(
  db: DatabaseExecutor,
  where: string,
  values: unknown[],
  requestedPage: string | number | undefined,
  includeHistory = false,
): Promise<BookingPage> {
  const parsedPage = Number(requestedPage ?? 1);
  const safePage = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const count = await one<{ total: number | string }>(
    db,
    `SELECT COUNT(*) AS total FROM bookings b WHERE ${where}`,
    ...values,
  );
  const total = Number(count?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / BOOKING_PAGE_SIZE));
  const page = Math.min(safePage, totalPages);
  const items = await many<Booking>(
    db,
    bookingQuery + ` WHERE ${where} ORDER BY b.created_at DESC,b.id DESC LIMIT ? OFFSET ?`,
    ...values,
    BOOKING_PAGE_SIZE,
    (page - 1) * BOOKING_PAGE_SIZE,
  );
  const historyByBookingId: Record<string, BookingHistoryEntry[]> = {};
  if (includeHistory && items.length) {
    const ids = items.map((item) => item.id);
    const actions = [
      "booking.requested",
      "booking.confirmed",
      "booking.declined",
      "booking.cancelled",
      "stay.checkin",
      "stay.checkout",
    ];
    const history = await many<BookingHistoryEntry & { booking_id: string }>(
      db,
      `SELECT a.entity_id AS booking_id,a.action,a.created_at
         FROM platform_audit a
         JOIN bookings b ON b.id=a.entity_id
        WHERE a.company_id=b.company_id
          AND ${where}
          AND a.entity_id IN (${ids.map(() => "?").join(",")})
          AND a.action IN (${actions.map(() => "?").join(",")})
        ORDER BY a.created_at ASC,a.id ASC`,
      ...values,
      ...ids,
      ...actions,
    );
    for (const entry of history) {
      (historyByBookingId[entry.booking_id] ??= []).push({
        action: entry.action,
        created_at: entry.created_at,
      });
    }
  }
  return { items, historyByBookingId, page, pageSize: BOOKING_PAGE_SIZE, total, totalPages };
}
