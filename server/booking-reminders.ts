import { lockSuffix, type DatabaseExecutor } from "../db/index.ts";
import { many, one, run, write } from "./platform-store.ts";

export const BOOKING_REMINDER_LEAD_HOURS = 24;
export const BOOKING_REMINDER_LEAD_MS = BOOKING_REMINDER_LEAD_HOURS * 60 * 60_000;
const HOTEL_REMINDER_START_HOUR_MANAUS = 9;
const REMINDER_BATCH_SIZE = 200;
const MANAUS_UTC_OFFSET_MS = 4 * 60 * 60_000;

type ReminderBooking = {
  id: string;
  user_id: string;
  company_id: string;
  kind: "hotel" | "tour";
  status: string;
  check_in: string | null;
  starts_at: string | null;
};

function hotelReminderStartAt(checkIn: string) {
  return new Date(
    Date.parse(
      `${checkIn}T${String(HOTEL_REMINDER_START_HOUR_MANAUS).padStart(2, "0")}:00:00.000-04:00`,
    ),
  );
}

function addManausCalendarDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T12:00:00.000Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function todayInManaus(now: Date) {
  return new Date(now.getTime() - MANAUS_UTC_OFFSET_MS).toISOString().slice(0, 10);
}

export function bookingReminderStartAt(
  booking: Pick<ReminderBooking, "kind" | "check_in" | "starts_at">,
) {
  const startAt =
    booking.kind === "hotel"
      ? booking.check_in
        ? hotelReminderStartAt(booking.check_in).getTime()
        : NaN
      : booking.starts_at
        ? Date.parse(booking.starts_at)
        : NaN;
  return Number.isFinite(startAt) ? new Date(startAt) : null;
}

export function bookingReminderDueAt(
  booking: Pick<ReminderBooking, "kind" | "check_in" | "starts_at">,
) {
  const startAt = bookingReminderStartAt(booking);
  return startAt ? new Date(startAt.getTime() - BOOKING_REMINDER_LEAD_MS) : null;
}

async function reminderCandidates(db: DatabaseExecutor, now: Date) {
  const today = todayInManaus(now);
  const tomorrow = addManausCalendarDays(today, 1);
  const todayHotelStart = hotelReminderStartAt(today);
  const hotelBookings = await many<ReminderBooking>(
    db,
    `SELECT b.id,b.user_id,b.company_id,b.kind,b.status,b.check_in,NULL AS starts_at
       FROM bookings b
      WHERE b.kind='hotel' AND b.status='confirmed' AND b.check_in>=? AND b.check_in<=?
        AND (b.check_in>? OR (b.check_in=? AND ?<?))
        AND NOT EXISTS (SELECT 1 FROM booking_reminders r WHERE r.booking_id=b.id)
      ORDER BY b.check_in,b.id
      LIMIT ?`,
    today,
    tomorrow,
    today,
    today,
    now.toISOString(),
    todayHotelStart.toISOString(),
    REMINDER_BATCH_SIZE,
  );
  const tourBookings = await many<ReminderBooking>(
    db,
    `SELECT b.id,b.user_id,b.company_id,b.kind,b.status,b.check_in,d.starts_at
       FROM bookings b
       JOIN departures d ON d.id=b.departure_id
      WHERE b.kind='tour' AND b.status='confirmed' AND d.starts_at>? AND d.starts_at<=?
        AND NOT EXISTS (SELECT 1 FROM booking_reminders r WHERE r.booking_id=b.id)
      ORDER BY d.starts_at,b.id
      LIMIT ?`,
    now.toISOString(),
    new Date(now.getTime() + BOOKING_REMINDER_LEAD_MS).toISOString(),
    REMINDER_BATCH_SIZE,
  );
  return [...hotelBookings, ...tourBookings];
}

export async function dispatchDueBookingReminders(db: DatabaseExecutor, now = new Date()) {
  const candidates = await reminderCandidates(db, now);
  let created = 0;

  for (const candidate of candidates) {
    const inserted = await write(db, async (tx) => {
      const booking = await one<ReminderBooking>(
        tx,
        `SELECT b.id,b.user_id,b.company_id,b.kind,b.status,b.check_in,d.starts_at
           FROM bookings b
           LEFT JOIN departures d ON d.id=b.departure_id
          WHERE b.id=?` + lockSuffix(tx, "b"),
        candidate.id,
      );
      if (!booking || booking.status !== "confirmed") return false;

      const startAt = bookingReminderStartAt(booking);
      const dueAt = bookingReminderDueAt(booking);
      if (
        !startAt ||
        !dueAt ||
        startAt.getTime() <= now.getTime() ||
        dueAt.getTime() > now.getTime()
      )
        return false;

      const result = await run(
        tx,
        `INSERT INTO booking_reminders (id,user_id,company_id,booking_id,created_at,read_at)
         VALUES (?,?,?,?,?,NULL)
         ON CONFLICT(booking_id) DO NOTHING`,
        crypto.randomUUID(),
        booking.user_id,
        booking.company_id,
        booking.id,
        now.toISOString(),
      );
      return result.changes > 0;
    });
    if (inserted) created += 1;
  }

  return created;
}
