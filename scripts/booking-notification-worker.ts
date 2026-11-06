import { setTimeout as delay } from "node:timers/promises";
import { getDatabase, isPostgresDatabase } from "../db/index.ts";
import { isEmailDeliveryConfigured } from "../server/email.ts";
import { processNextBookingEmail } from "../server/booking-email-delivery-service.ts";
import { sendBookingEmail } from "../server/booking-email.ts";
import {
  bookingEmailOutboxSummary,
  bookingEmailNotificationsEnabled,
} from "../server/booking-email-queue-service.ts";
import { dispatchDueBookingReminders } from "../server/booking-reminders.ts";
import {
  BOOKING_EMAIL_WORKER_HEARTBEAT_INTERVAL_MS,
  recordBookingEmailWorkerHeartbeat,
} from "../server/booking-email-worker-heartbeat.ts";

async function main() {
  const enabled = bookingEmailNotificationsEnabled();
  if (enabled && !isEmailDeliveryConfigured())
    throw new Error(
      "BOOKING_EMAIL_NOTIFICATIONS=true exige SMTP_HOST, SMTP_FROM e credenciais SMTP completas.",
    );

  const db = getDatabase();
  let stopping = false;
  const stop = () => (stopping = true);
  let heartbeatInFlight: Promise<void> | undefined;
  let heartbeatTimer: NodeJS.Timeout | undefined;
  const updateHeartbeat = () => {
    if (!heartbeatInFlight) {
      heartbeatInFlight = recordBookingEmailWorkerHeartbeat(db, "running").finally(() => {
        heartbeatInFlight = undefined;
      });
    }
    return heartbeatInFlight;
  };
  const reportHeartbeatError = (error: unknown) => {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "WORKER_HEARTBEAT_ERROR";
    console.error(JSON.stringify({ event: "booking_email_worker_heartbeat_error", code }));
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    await updateHeartbeat();
    heartbeatTimer = setInterval(() => {
      void updateHeartbeat().catch(reportHeartbeatError);
    }, BOOKING_EMAIL_WORKER_HEARTBEAT_INTERVAL_MS);
    heartbeatTimer.unref();
    console.info(
      `Worker de reservas iniciado; lembretes internos ativos; avisos por e-mail ${enabled ? "ativos" : "desativados"}.`,
    );
    let nextSummaryAt = 0;
    while (!stopping) {
      try {
        const remindersCreated = await dispatchDueBookingReminders(db);
        if (remindersCreated > 0)
          console.info(
            JSON.stringify({ event: "booking_reminders_created", count: remindersCreated }),
          );
        const result = enabled ? await processNextBookingEmail(db, sendBookingEmail) : "idle";
        if (Date.now() >= nextSummaryAt) {
          const counts = await bookingEmailOutboxSummary(db);
          console.info(JSON.stringify({ event: "booking_email_outbox_status", counts }));
          nextSummaryAt = Date.now() + 60_000;
        }
        if (result === "idle" && remindersCreated === 0) {
          await delay(enabled ? 1_000 : 15_000);
          continue;
        }
        if (result === "idle") continue;
        const entry = JSON.stringify({ event: "booking_email_delivery", result });
        if (result === "failed") console.error(entry);
        else console.info(entry);
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String(error.code)
            : "WORKER_ERROR";
        console.error(JSON.stringify({ event: "booking_email_worker_error", code }));
        await delay(5_000);
      }
    }
  } finally {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
    await heartbeatInFlight?.catch(reportHeartbeatError);
    await recordBookingEmailWorkerHeartbeat(db, "stopped").catch(reportHeartbeatError);
    if (isPostgresDatabase(db)) await db.end();
    else db.close();
  }
}

main().catch((error) => {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "WORKER_STARTUP_ERROR";
  console.error(JSON.stringify({ event: "booking_email_worker_startup_error", code }));
  process.exitCode = 1;
});
