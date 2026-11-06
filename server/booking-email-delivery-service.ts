import { isPostgresExecutor, lockSuffix, type DatabaseExecutor } from "../db/index.ts";
import { one, run, write } from "./platform-store.ts";
import type { BookingEmailEvent, BookingEmailMessage } from "./booking-email.ts";

const MAX_ATTEMPTS = 8;
const BASE_RETRY_DELAY_MS = 30_000;
const MAX_RETRY_DELAY_MS = 6 * 60 * 60_000;
const WORKER_LEASE_MS = 60_000;

type ClaimedDelivery = { id: string; event: BookingEmailEvent; attempts: number };
type DeliveryDetails = BookingEmailMessage;
export type BookingEmailDeliveryResult = "idle" | "sent" | "retry_scheduled" | "failed";
export type BookingEmailSender = (message: BookingEmailMessage) => Promise<void>;

async function claimNextDelivery(db: DatabaseExecutor, now: Date): Promise<ClaimedDelivery | null> {
  const timestamp = now.toISOString();
  return write(db, async (tx) => {
    await run(
      tx,
      `UPDATE booking_email_outbox
          SET status='failed',locked_until=NULL,last_error_code='MAX_ATTEMPTS',updated_at=?
        WHERE status='sending' AND locked_until<=? AND attempts>=?`,
      timestamp,
      timestamp,
      MAX_ATTEMPTS,
    );
    const skipLocked = isPostgresExecutor(tx) ? " SKIP LOCKED" : "";
    const item = await one<ClaimedDelivery>(
      tx,
      `SELECT id,event,attempts
         FROM booking_email_outbox
        WHERE attempts<?
          AND ((status='pending' AND available_at<=?) OR (status='sending' AND locked_until<=?))
        ORDER BY available_at,created_at,id
        LIMIT 1${lockSuffix(tx)}${skipLocked}`,
      MAX_ATTEMPTS,
      timestamp,
      timestamp,
    );
    if (!item) return null;
    const attempts = item.attempts + 1;
    await run(
      tx,
      `UPDATE booking_email_outbox
          SET status='sending',attempts=?,locked_until=?,updated_at=?
        WHERE id=?`,
      attempts,
      new Date(now.getTime() + WORKER_LEASE_MS).toISOString(),
      timestamp,
      item.id,
    );
    return { ...item, attempts };
  });
}

function deliveryErrorCode(error: unknown) {
  if (!error || typeof error !== "object") return "DELIVERY_FAILED";
  const candidate = "code" in error ? String(error.code) : "";
  if (/^[A-Z0-9_]{1,40}$/.test(candidate)) return candidate;
  const responseCode = "responseCode" in error ? Number(error.responseCode) : NaN;
  return Number.isInteger(responseCode) ? `SMTP_${responseCode}` : "DELIVERY_FAILED";
}

async function recordFailure(
  db: DatabaseExecutor,
  delivery: ClaimedDelivery,
  now: Date,
  error: unknown,
) {
  const terminal = delivery.attempts >= MAX_ATTEMPTS;
  const retryDelay = Math.min(
    MAX_RETRY_DELAY_MS,
    BASE_RETRY_DELAY_MS * 2 ** Math.max(0, delivery.attempts - 1),
  );
  await run(
    db,
    `UPDATE booking_email_outbox
        SET status=?,available_at=?,locked_until=NULL,last_error_code=?,updated_at=?
      WHERE id=? AND status='sending'`,
    terminal ? "failed" : "pending",
    new Date(now.getTime() + retryDelay).toISOString(),
    deliveryErrorCode(error),
    now.toISOString(),
    delivery.id,
  );
}

async function loadDeliveryDetails(db: DatabaseExecutor, id: string) {
  return one<DeliveryDetails>(
    db,
    `SELECT o.id,u.email AS "to",o.event,o.booking_id AS "bookingId",o.company_id AS "companyId",
            c.kind AS "companyKind",c.name AS "companyName"
       FROM booking_email_outbox o
       JOIN "user" u ON u.id=o.user_id
       JOIN companies c ON c.id=o.company_id
       JOIN bookings b ON b.id=o.booking_id
      WHERE o.id=?`,
    id,
  );
}

export async function processNextBookingEmail(
  db: DatabaseExecutor,
  send: BookingEmailSender,
  now = new Date(),
): Promise<BookingEmailDeliveryResult> {
  const delivery = await claimNextDelivery(db, now);
  if (!delivery) return "idle";
  try {
    const details = await loadDeliveryDetails(db, delivery.id);
    if (!details)
      throw Object.assign(new Error("Booking email recipient is unavailable."), {
        code: "MISSING_RECIPIENT",
      });
    await send(details);
  } catch (error) {
    await recordFailure(db, delivery, now, error);
    return delivery.attempts >= MAX_ATTEMPTS ? "failed" : "retry_scheduled";
  }
  const result = await run(
    db,
    `UPDATE booking_email_outbox
        SET status='sent',locked_until=NULL,sent_at=?,last_error_code=NULL,updated_at=?
      WHERE id=? AND status='sending'`,
    now.toISOString(),
    now.toISOString(),
    delivery.id,
  );
  if (result.changes !== 1)
    throw new Error("The booking email lease was lost before acknowledgment.");
  return "sent";
}
