import { getDatabase, isPostgresDatabase } from "../db/index.ts";
import { isEmailDeliveryConfigured } from "../server/email.ts";
import {
  bookingEmailNotificationsEnabled,
  retryFailedBookingEmails,
} from "../server/booking-email-queue-service.ts";

async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== "--confirm")
    throw new Error(
      "Use `npm run notifications:retry-failed -- --confirm` para confirmar a reentrega.",
    );
  if (!bookingEmailNotificationsEnabled())
    throw new Error("Ative BOOKING_EMAIL_NOTIFICATIONS=true antes de reabrir entregas.");
  if (!isEmailDeliveryConfigured())
    throw new Error("Configure SMTP antes de reabrir entregas de e-mail.");

  const db = getDatabase();
  try {
    const count = await retryFailedBookingEmails(db);
    console.info(`Entregas reabertas para nova tentativa: ${count}.`);
  } finally {
    if (isPostgresDatabase(db)) await db.end();
    else db.close();
  }
}

main().catch((error) => {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : error instanceof Error
        ? error.message
        : "OPERATION_FAILED";
  console.error(JSON.stringify({ event: "booking_email_retry_failed_error", code }));
  process.exitCode = 1;
});
