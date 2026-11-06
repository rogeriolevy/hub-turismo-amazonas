import { one, run, type DatabaseExecutor } from "../db/index.ts";

export const BOOKING_EMAIL_WORKER_ID = "booking-email-worker";
export const BOOKING_EMAIL_WORKER_HEARTBEAT_INTERVAL_MS = 15_000;
export const BOOKING_EMAIL_WORKER_STALE_AFTER_MS = 45_000;

export type BookingEmailWorkerState = "running" | "disabled" | "stopped";
export type BookingEmailWorkerStatus = "running" | "disabled" | "stopped" | "stale" | "unknown";

export type BookingEmailWorkerHeartbeat = {
  state: BookingEmailWorkerState;
  lastSeenAt: string;
};

export type BookingEmailWorkerHealth = {
  state: BookingEmailWorkerStatus;
  lastSeenAt: string | null;
  ageSeconds: number | null;
};

export async function recordBookingEmailWorkerHeartbeat(
  db: DatabaseExecutor,
  state: BookingEmailWorkerState,
  now = new Date(),
) {
  await run(
    db,
    `INSERT INTO booking_email_worker_heartbeat (worker_id,state,last_seen_at)
     VALUES (?,?,?)
     ON CONFLICT(worker_id) DO UPDATE
       SET state=excluded.state,last_seen_at=excluded.last_seen_at`,
    BOOKING_EMAIL_WORKER_ID,
    state,
    now.toISOString(),
  );
}

export async function bookingEmailWorkerHealth(
  db: DatabaseExecutor,
  now = new Date(),
): Promise<BookingEmailWorkerHealth> {
  const heartbeat = await one<BookingEmailWorkerHeartbeat>(
    db,
    `SELECT state,last_seen_at AS "lastSeenAt"
       FROM booking_email_worker_heartbeat
      WHERE worker_id=?`,
    BOOKING_EMAIL_WORKER_ID,
  );
  if (!heartbeat) return { state: "unknown", lastSeenAt: null, ageSeconds: null };

  const seenAt = Date.parse(heartbeat.lastSeenAt);
  if (!Number.isFinite(seenAt)) return { state: "unknown", lastSeenAt: null, ageSeconds: null };

  const ageMs = Math.max(0, now.getTime() - seenAt);
  const state =
    heartbeat.state === "stopped"
      ? "stopped"
      : ageMs > BOOKING_EMAIL_WORKER_STALE_AFTER_MS
        ? "stale"
        : heartbeat.state;
  return {
    state,
    lastSeenAt: heartbeat.lastSeenAt,
    ageSeconds: Math.floor(ageMs / 1_000),
  };
}
