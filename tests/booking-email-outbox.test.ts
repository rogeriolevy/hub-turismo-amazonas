import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import { openDatabase } from "../db/index.ts";
import { migrateDatabase } from "../db/migrate-auth.ts";
import { todayInManaus } from "../lib/platform-schema.ts";
import {
  processNextBookingEmail,
  retryFailedBookingEmails,
} from "../server/booking-email-outbox.ts";
import { renderBookingEmail, type BookingEmailMessage } from "../server/booking-email.ts";
import { bookingEmailOperationsSummary } from "../server/booking-email-operations-service.ts";
import { recordBookingEmailWorkerHeartbeat } from "../server/booking-email-worker-heartbeat.ts";
import { cancelBooking, requestBooking, decideBooking } from "../server/booking-service.ts";
import { saveCompany, saveMember, saveRoom } from "../server/company-service.ts";
import { HttpError } from "../server/http.ts";
import type { Actor } from "../server/platform-models.ts";

const day = (offset: number) =>
  new Date(Date.parse(todayInManaus() + "T12:00:00Z") + offset * 86_400_000)
    .toISOString()
    .slice(0, 10);

test("booking email outbox retries delivery without duplicating the booking", async () => {
  const previousEnvironment = {
    adminEmails: process.env.ADMIN_EMAILS,
    authSecret: process.env.BETTER_AUTH_SECRET,
    bookingEmailNotifications: process.env.BOOKING_EMAIL_NOTIFICATIONS,
    siteUrl: process.env.SITE_URL,
  };
  process.env.ADMIN_EMAILS = "root@booking-email.test";
  process.env.BETTER_AUTH_SECRET = randomBytes(48).toString("base64url");
  process.env.BOOKING_EMAIL_NOTIFICATIONS = "true";
  process.env.SITE_URL = "https://hub.example.test";
  const db = openDatabase(":memory:");
  try {
    await migrateDatabase(db);
    const now = new Date().toISOString();
    const createUser = (email: string, name: string): Actor => {
      const actor = { id: randomUUID(), email, name };
      db.prepare(
        'INSERT INTO "user" (id,name,email,emailVerified,createdAt,updatedAt) VALUES (?,?,?,1,?,?)',
      ).run(actor.id, actor.name, actor.email, now, now);
      return actor;
    };
    const root = createUser("root@booking-email.test", "Administração");
    const manager = createUser("gestao@booking-email.test", "Gestão");
    const guest = createUser("turista@booking-email.test", "Turista");
    await assert.rejects(
      bookingEmailOperationsSummary(db, guest),
      (error: unknown) => error instanceof HttpError && error.status === 403,
      "operational email summaries are administrator-only",
    );
    const company = await saveCompany(db, root, {
      kind: "hotel",
      name: "Hotel & <Floresta>",
      slug: "hotel-notificacoes-email",
      city: "Maués",
      description: "Hotel fictício para validar o outbox de reservas.",
      status: "published",
    });
    await saveMember(db, root, {
      company_id: company.id,
      email: manager.email,
      role: "hotel_manager",
    });
    const room = await saveRoom(db, manager, {
      company_id: company.id,
      code: "E1",
      name: "Quarto de ensaio",
      capacity: 2,
      price_cents: 25000,
      active: true,
    });
    const request = {
      kind: "hotel" as const,
      room_id: room.id,
      check_in: day(1),
      check_out: day(2),
      guests: 1,
      notes: "",
    };
    const requestKey = randomUUID();
    const booking = await requestBooking(db, guest, request, requestKey);
    assert.deepEqual(await requestBooking(db, guest, request, requestKey), booking);
    const queuedCount = db
      .prepare(
        "SELECT count(*) AS count FROM booking_email_outbox WHERE booking_id=? AND event='booking.requested'",
      )
      .get(booking.id) as { count: number };
    assert.equal(queuedCount.count, 1);
    const initialOperations = await bookingEmailOperationsSummary(db, root);
    assert.equal(initialOperations.enabled, true);
    assert.deepEqual(initialOperations.worker, {
      state: "unknown",
      lastSeenAt: null,
      ageSeconds: null,
    });
    assert.deepEqual(initialOperations.statuses, [
      { status: "pending", count: 1 },
      { status: "sending", count: 0 },
      { status: "sent", count: 0 },
      { status: "failed", count: 0 },
    ]);

    const heartbeatAt = new Date();
    await recordBookingEmailWorkerHeartbeat(db, "running", heartbeatAt);
    assert.equal(
      (await bookingEmailOperationsSummary(db, root, new Date(heartbeatAt.getTime() + 45_000)))
        .worker.state,
      "running",
      "a heartbeat remains fresh at the stale threshold",
    );
    const staleWorker = await bookingEmailOperationsSummary(
      db,
      root,
      new Date(heartbeatAt.getTime() + 46_000),
    );
    assert.equal(staleWorker.worker.state, "stale");
    assert.equal(staleWorker.worker.ageSeconds, 46);
    await recordBookingEmailWorkerHeartbeat(db, "disabled", heartbeatAt);
    assert.equal(
      (await bookingEmailOperationsSummary(db, root, heartbeatAt)).worker.state,
      "disabled",
      "a live worker is distinguishable from a disabled email channel",
    );
    await recordBookingEmailWorkerHeartbeat(db, "stopped", heartbeatAt);
    assert.equal(
      (await bookingEmailOperationsSummary(db, root, new Date(heartbeatAt.getTime() + 60_000)))
        .worker.state,
      "stopped",
      "a recorded graceful shutdown remains distinguishable from a stale heartbeat",
    );

    const delivered: BookingEmailMessage[] = [];
    assert.equal(
      await processNextBookingEmail(
        db,
        async (message) => {
          delivered.push(message);
        },
        new Date(Date.now() + 1_000),
      ),
      "sent",
    );
    assert.equal(delivered[0].to, manager.email);
    assert.equal(delivered[0].event, "booking.requested");
    const teamEmail = renderBookingEmail(delivered[0]);
    assert.ok(
      teamEmail.html.includes("Hotel &amp; &lt;Floresta&gt;"),
      "company names are escaped in HTML email",
    );
    const teamLink = new URL(teamEmail.text.split("\n")[4]);
    assert.equal(teamLink.origin, "https://hub.example.test");
    assert.equal(teamLink.pathname, "/painel/hotel/reservas");
    assert.equal(teamLink.searchParams.get("empresa"), company.id);
    assert.equal(teamLink.searchParams.get("reserva"), booking.id);

    await decideBooking(db, manager, {
      company_id: company.id,
      booking_id: booking.id,
      decision: "confirmed",
    });
    const failedAt = new Date(Date.now() + 2_000);
    assert.equal(
      await processNextBookingEmail(
        db,
        async (message) => {
          delivered.push(message);
          throw Object.assign(new Error("SMTP details stay out of the outbox."), {
            code: "EUPSTREAM",
          });
        },
        failedAt,
      ),
      "retry_scheduled",
    );
    const pending = db
      .prepare(
        "SELECT status,attempts,available_at,last_error_code FROM booking_email_outbox WHERE booking_id=? AND event='booking.confirmed'",
      )
      .get(booking.id) as {
      status: string;
      attempts: number;
      available_at: string;
      last_error_code: string;
    };
    assert.equal(pending.status, "pending");
    assert.equal(pending.attempts, 1);
    assert.equal(pending.last_error_code, "EUPSTREAM");
    const retryOperations = await bookingEmailOperationsSummary(db, root);
    assert.deepEqual(
      retryOperations.statuses.map(({ status, count }) => [status, count]),
      [
        ["pending", 1],
        ["sending", 0],
        ["sent", 1],
        ["failed", 0],
      ],
    );
    const retryAt = new Date(failedAt.getTime() + 30_000);
    assert.equal(pending.available_at, retryAt.toISOString());
    assert.equal(
      await processNextBookingEmail(
        db,
        async () => undefined,
        new Date(failedAt.getTime() + 10_000),
      ),
      "idle",
      "the worker must respect the backoff before retrying",
    );
    assert.equal(
      await processNextBookingEmail(
        db,
        async (message) => {
          delivered.push(message);
        },
        retryAt,
      ),
      "sent",
    );
    assert.equal(delivered[1].to, guest.email);
    assert.equal(delivered[1].event, "booking.confirmed");
    assert.equal(delivered[1].id, delivered[2].id, "retries keep a stable delivery identifier");
    const guestLink = new URL(renderBookingEmail(delivered[2]).text.split("\n")[4]);
    assert.equal(guestLink.pathname, "/minha-conta/reservas");
    assert.equal(guestLink.searchParams.get("reserva"), booking.id);
    assert.deepEqual(
      db.prepare("SELECT status,attempts FROM booking_email_outbox ORDER BY event").all(),
      [
        { status: "sent", attempts: 2 },
        { status: "sent", attempts: 1 },
      ],
    );

    const exhaustedAt = new Date(Date.now() + 60_000);
    db.prepare(
      `UPDATE booking_email_outbox
          SET status='pending',attempts=0,available_at=?,locked_until=NULL,sent_at=NULL
        WHERE booking_id=? AND event='booking.requested'`,
    ).run(exhaustedAt.toISOString(), booking.id);
    let attemptAt = exhaustedAt;
    for (let attempt = 1; attempt <= 8; attempt++) {
      assert.equal(
        await processNextBookingEmail(
          db,
          async () => {
            throw Object.assign(new Error("temporary transport failure"), { code: "ETEMPORARY" });
          },
          attemptAt,
        ),
        attempt === 8 ? "failed" : "retry_scheduled",
      );
      const scheduled = db
        .prepare(
          "SELECT available_at FROM booking_email_outbox WHERE booking_id=? AND event='booking.requested'",
        )
        .get(booking.id) as { available_at: string };
      attemptAt = new Date(scheduled.available_at);
    }
    const terminal = db
      .prepare(
        "SELECT status,attempts,last_error_code FROM booking_email_outbox WHERE booking_id=? AND event='booking.requested'",
      )
      .get(booking.id) as { status: string; attempts: number; last_error_code: string };
    assert.deepEqual(terminal, { status: "failed", attempts: 8, last_error_code: "ETEMPORARY" });
    const terminalOperations = await bookingEmailOperationsSummary(db, root);
    assert.equal(terminalOperations.statuses.find(({ status }) => status === "failed")?.count, 1);
    assert.deepEqual(terminalOperations.failures, [
      {
        bookingId: booking.id,
        bookingReference: booking.id.slice(0, 8),
        event: "booking.requested",
        attempts: 8,
        lastErrorCode: "ETEMPORARY",
        recipientCount: 1,
        updatedAt: terminalOperations.failures[0].updatedAt,
      },
    ]);
    assert.equal("email" in terminalOperations.failures[0], false);
    assert.equal(await retryFailedBookingEmails(db), 1);
    const retried = db
      .prepare(
        "SELECT status,attempts,last_error_code FROM booking_email_outbox WHERE booking_id=? AND event='booking.requested'",
      )
      .get(booking.id) as {
      status: string;
      attempts: number;
      last_error_code: string | null;
    };
    assert.deepEqual(retried, { status: "pending", attempts: 0, last_error_code: null });
    assert.equal(await processNextBookingEmail(db, async () => undefined), "sent");

    const declinedBooking = await requestBooking(
      db,
      guest,
      { ...request, check_in: day(3), check_out: day(4) },
      randomUUID(),
    );
    await decideBooking(db, manager, {
      company_id: company.id,
      booking_id: declinedBooking.id,
      decision: "declined",
    });
    const declinedMessages: BookingEmailMessage[] = [];
    for (let index = 0; index < 2; index++)
      assert.equal(
        await processNextBookingEmail(db, async (message) => {
          declinedMessages.push(message);
        }),
        "sent",
      );
    assert.deepEqual(
      declinedMessages
        .map(({ event, to }) => ({ event, to }))
        .sort((left, right) => left.event.localeCompare(right.event)),
      [
        { event: "booking.declined", to: guest.email },
        { event: "booking.requested", to: manager.email },
      ],
    );
    assert.equal(
      renderBookingEmail(declinedMessages.find((message) => message.event === "booking.declined")!)
        .subject,
      "Atualização sobre sua reserva | Hub Turismo Amazonas",
    );

    const cancelledBooking = await requestBooking(
      db,
      guest,
      { ...request, check_in: day(5), check_out: day(6) },
      randomUUID(),
    );
    await cancelBooking(db, guest, cancelledBooking.id);
    const cancellationMessages: BookingEmailMessage[] = [];
    for (let index = 0; index < 2; index++)
      assert.equal(
        await processNextBookingEmail(db, async (message) => {
          cancellationMessages.push(message);
        }),
        "sent",
      );
    assert.deepEqual(cancellationMessages.map((message) => message.event).sort(), [
      "booking.cancelled",
      "booking.requested",
    ]);
    assert.equal(
      cancellationMessages.find((message) => message.event === "booking.cancelled")?.to,
      manager.email,
    );
  } finally {
    db.close();
    if (previousEnvironment.adminEmails === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = previousEnvironment.adminEmails;
    if (previousEnvironment.authSecret === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = previousEnvironment.authSecret;
    if (previousEnvironment.bookingEmailNotifications === undefined)
      delete process.env.BOOKING_EMAIL_NOTIFICATIONS;
    else process.env.BOOKING_EMAIL_NOTIFICATIONS = previousEnvironment.bookingEmailNotifications;
    if (previousEnvironment.siteUrl === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = previousEnvironment.siteUrl;
  }
});
