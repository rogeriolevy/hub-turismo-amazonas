import type { DatabaseExecutor } from "../db/index.ts";
import type { BookingEmailEvent } from "./booking-email.ts";
import {
  bookingEmailNotificationsEnabled,
  bookingEmailOutboxSummary,
} from "./booking-email-queue-service.ts";
import {
  bookingEmailWorkerHealth,
  type BookingEmailWorkerHealth,
} from "./booking-email-worker-heartbeat.ts";
import { requirePlatformAdmin } from "./platform-access.ts";
import { many } from "./platform-store.ts";
import type { Actor } from "./platform-models.ts";

const statuses = ["pending", "sending", "sent", "failed"] as const;
type Status = (typeof statuses)[number];

export type BookingEmailOperationsSummary = {
  enabled: boolean;
  statuses: { status: Status; count: number }[];
  total: number;
  worker: BookingEmailWorkerHealth;
  failures: {
    bookingId: string;
    bookingReference: string;
    event: BookingEmailEvent;
    attempts: number;
    lastErrorCode: string | null;
    recipientCount: number;
    updatedAt: string;
  }[];
};

export async function bookingEmailOperationsSummary(
  db: DatabaseExecutor,
  actor: Actor,
  now = new Date(),
): Promise<BookingEmailOperationsSummary> {
  requirePlatformAdmin(actor);
  const [rows, failures, worker] = await Promise.all([
    bookingEmailOutboxSummary(db),
    many<{
      bookingId: string;
      bookingReference: string;
      event: BookingEmailEvent;
      attempts: number | string;
      lastErrorCode: string | null;
      recipientCount: number | string;
      updatedAt: string;
    }>(
      db,
      `SELECT booking_id AS "bookingId",substr(booking_id,1,8) AS "bookingReference",event,
              CAST(max(attempts) AS INTEGER) AS attempts,last_error_code AS "lastErrorCode",
              CAST(count(*) AS INTEGER) AS "recipientCount",max(updated_at) AS "updatedAt"
         FROM booking_email_outbox
        WHERE status='failed'
        GROUP BY booking_id,event,last_error_code
        ORDER BY max(updated_at) DESC,booking_id,event
        LIMIT 20`,
    ),
    bookingEmailWorkerHealth(db, now),
  ]);
  const counts = new Map(rows.map((row) => [row.status, Number(row.count)]));
  const normalizedStatuses = statuses.map((status) => ({
    status,
    count: counts.get(status) ?? 0,
  }));

  return {
    enabled: bookingEmailNotificationsEnabled(),
    statuses: normalizedStatuses,
    total: normalizedStatuses.reduce((total, row) => total + row.count, 0),
    worker,
    failures: failures.map((failure) => ({
      ...failure,
      attempts: Number(failure.attempts),
      recipientCount: Number(failure.recipientCount),
    })),
  };
}
