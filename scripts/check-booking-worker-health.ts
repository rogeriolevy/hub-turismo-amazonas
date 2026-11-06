import { getDatabase, isPostgresDatabase } from "../db/index.ts";
import { bookingEmailWorkerHealth } from "../server/booking-email-worker-heartbeat.ts";

function fail(code: string) {
  console.error(JSON.stringify({ event: "booking_email_worker_health_check_failed", code }));
  process.exitCode = 1;
}

function safeErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "UNKNOWN";
  const code = String(error.code);
  return /^[A-Za-z0-9_-]{1,64}$/.test(code) ? code : "UNKNOWN";
}

async function main() {
  if (!process.env.DATABASE_URL) {
    fail("DATABASE_URL_MISSING");
    return;
  }

  let db: ReturnType<typeof getDatabase> | undefined;
  try {
    db = getDatabase();
    if (!isPostgresDatabase(db)) {
      fail("DATABASE_NOT_POSTGRESQL");
      return;
    }

    const health = await bookingEmailWorkerHealth(db);
    if (health.state !== "running") {
      fail(`HEARTBEAT_${health.state.toUpperCase()}`);
      return;
    }
    console.info(
      JSON.stringify({
        event: "booking_email_worker_health_check_ok",
        age_seconds: health.ageSeconds,
      }),
    );
  } catch (error) {
    fail(`HEALTH_CHECK_ERROR_${safeErrorCode(error)}`);
  } finally {
    if (db) {
      if (isPostgresDatabase(db)) {
        await db.end().catch(() => fail("DATABASE_POOL_CLOSE_FAILED"));
      } else db.close();
    }
  }
}

void main();
