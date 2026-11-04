import type { DatabaseExecutor } from "../db/index.ts";
import { many, run, write } from "./platform-store.ts";
import type { BookingEmailEvent } from "./booking-email.ts";

export function bookingEmailNotificationsEnabled() {
  const value = process.env.BOOKING_EMAIL_NOTIFICATIONS?.trim().toLowerCase();
  if (value && value !== "true" && value !== "false")
    throw new Error("BOOKING_EMAIL_NOTIFICATIONS precisa ser true ou false.");
  return value === "true";
}

export async function enqueueBookingEmailNotification(
  db: DatabaseExecutor,
  userId: string,
  companyId: string,
  bookingId: string,
  event: BookingEmailEvent,
  createdAt: string,
) {
  if (!bookingEmailNotificationsEnabled()) return;
  await run(
    db,
    `INSERT INTO booking_email_outbox
       (id,user_id,company_id,booking_id,event,status,attempts,available_at,locked_until,sent_at,last_error_code,created_at,updated_at)
     VALUES (?,?,?,?,?,'pending',0,?,NULL,NULL,NULL,?,?)
     ON CONFLICT(user_id,booking_id,event) DO NOTHING`,
    crypto.randomUUID(),
    userId,
    companyId,
    bookingId,
    event,
    createdAt,
    createdAt,
    createdAt,
  );
}

export async function bookingEmailOutboxSummary(db: DatabaseExecutor) {
  return many<{ status: string; count: number | string }>(
    db,
    `SELECT status,CAST(count(*) AS INTEGER) AS count
       FROM booking_email_outbox
      GROUP BY status
      ORDER BY status`,
  );
}

export async function retryFailedBookingEmails(db: DatabaseExecutor) {
  return write(db, async (tx) => {
    const result = await run(
      tx,
      `UPDATE booking_email_outbox
          SET status='pending',attempts=0,available_at=?,locked_until=NULL,sent_at=NULL,
              last_error_code=NULL,updated_at=?
        WHERE status='failed'`,
      new Date().toISOString(),
      new Date().toISOString(),
    );
    return result.changes;
  });
}
