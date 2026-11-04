import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { Pool } from "pg";
import { migratePostgresDatabase } from "../db/migrate-postgres.ts";
import { todayInManaus } from "../lib/platform-schema.ts";
import {
  saveCompany,
  saveDeparture,
  saveMember,
  saveRoom,
  saveTour,
  setRoomOperationalStatus,
  companyInventory,
} from "../server/company-service.ts";
import {
  businessBookings,
  decideBooking,
  recordStay,
  requestBooking,
} from "../server/booking-service.ts";
import { searchProviders } from "../server/cadastur/public-directory.ts";
import { searchExperiences } from "../server/experience-directory-service.ts";
import { HttpError } from "../server/http.ts";
import {
  processNextBookingEmail,
  retryFailedBookingEmails,
} from "../server/booking-email-outbox.ts";
import type { BookingEmailMessage } from "../server/booking-email.ts";
import { bookingEmailOperationsSummary } from "../server/booking-email-operations-service.ts";
import { recordBookingEmailWorkerHeartbeat } from "../server/booking-email-worker-heartbeat.ts";
import { dispatchDueBookingReminders } from "../server/booking-reminders.ts";
import { myNotificationsPage } from "../server/notification-service.ts";
import type { Actor } from "../server/platform-models.ts";

const databaseUrl = process.env.TEST_DATABASE_URL;

async function waitForLockWaiters(pool: Pool, applicationName: string, expected: number) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const result = await pool.query<{ waiting: number }>(
      `SELECT count(*)::integer AS waiting
       FROM pg_stat_activity
       WHERE application_name=$1 AND wait_event_type='Lock' AND pid<>pg_backend_pid()`,
      [applicationName],
    );
    if (result.rows[0].waiting >= expected) return;
    await delay(20);
  }
  throw new Error(`PostgreSQL não registrou ${expected} operações aguardando o bloqueio.`);
}

async function runBehindRowLock(
  pool: Pool,
  monitor: Pool,
  applicationName: string,
  table: "rooms" | "departures",
  rowId: string,
  first: () => Promise<unknown>,
  second: () => Promise<unknown>,
) {
  const holder = await pool.connect();
  let firstOperation: Promise<unknown> | undefined;
  let secondOperation: Promise<unknown> | undefined;
  try {
    await holder.query("BEGIN");
    await holder.query(`SELECT id FROM ${table} WHERE id=$1 FOR UPDATE`, [rowId]);
    firstOperation = first();
    await waitForLockWaiters(monitor, applicationName, 1);
    secondOperation = second();
    await waitForLockWaiters(monitor, applicationName, 2);
    await holder.query("COMMIT");
    return await Promise.allSettled([firstOperation, secondOperation]);
  } catch (error) {
    await holder.query("ROLLBACK").catch(() => undefined);
    await Promise.allSettled([firstOperation, secondOperation].filter(Boolean));
    throw error;
  } finally {
    holder.release();
  }
}

function isConflict(result: PromiseSettledResult<unknown>) {
  return (
    result.status === "rejected" &&
    result.reason instanceof HttpError &&
    result.reason.status === 409
  );
}

test(
  "PostgreSQL enforces tenant scope and serializes booking and inventory operations",
  { skip: !databaseUrl },
  async () => {
    const schema = `hub_test_${randomUUID().replaceAll("-", "")}`;
    const applicationName = `${schema}_ops`;
    const previousBookingEmailNotifications = process.env.BOOKING_EMAIL_NOTIFICATIONS;
    const previousSiteUrl = process.env.SITE_URL;
    const adminPool = new Pool({
      connectionString: databaseUrl,
      application_name: applicationName,
    });
    let schemaCreated = false;
    let pool: Pool | undefined;
    try {
      await adminPool.query(`CREATE SCHEMA "${schema}"`);
      schemaCreated = true;
      pool = new Pool({
        connectionString: databaseUrl,
        options: `-c search_path=${schema},public`,
        application_name: applicationName,
        max: 8,
      });
      process.env.ADMIN_EMAILS = "root@concurrency.example.test";
      process.env.BOOKING_EMAIL_NOTIFICATIONS = "true";
      process.env.SITE_URL = "https://hub.example.test";
      await migratePostgresDatabase(pool);

      const now = new Date().toISOString();
      const root: Actor = {
        id: randomUUID(),
        email: "root@concurrency.example.test",
        name: "Administração de teste",
      };
      const manager: Actor = {
        id: randomUUID(),
        email: "manager@concurrency.example.test",
        name: "Gestão de teste",
      };
      const hotelStaff: Actor = {
        id: randomUUID(),
        email: "staff@concurrency.example.test",
        name: "Equipe de teste",
      };
      const guest: Actor = {
        id: randomUUID(),
        email: "guest@concurrency.example.test",
        name: "Turista de teste",
      };
      for (const user of [root, manager, hotelStaff, guest])
        await pool.query(
          'INSERT INTO "user" (id,name,email,"emailVerified","createdAt","updatedAt") VALUES ($1,$2,$3,false,$4,$4)',
          [user.id, user.name, user.email, now],
        );

      const hotelId = (
        await saveCompany(pool, root, {
          kind: "hotel",
          name: "Hotel de concorrência",
          slug: "hotel-concorrencia",
          city: "Maués",
          description: "Empresa temporária para validar operações simultâneas.",
          status: "published",
        })
      ).id;
      await saveMember(pool, root, {
        company_id: hotelId,
        email: manager.email,
        role: "hotel_manager",
      });
      await saveMember(pool, root, {
        company_id: hotelId,
        email: hotelStaff.email,
        role: "hotel_staff",
      });
      const roomForCapacity = (
        await saveRoom(pool, manager, {
          company_id: hotelId,
          code: "C1",
          name: "Quarto de capacidade",
          capacity: 2,
          price_cents: 25000,
          active: true,
        })
      ).id;
      const roomForStay = (
        await saveRoom(pool, manager, {
          company_id: hotelId,
          code: "C2",
          name: "Quarto de estadia",
          capacity: 2,
          price_cents: 25000,
          active: true,
        })
      ).id;
      const otherHotelId = (
        await saveCompany(pool, root, {
          kind: "hotel",
          name: "Outro hotel de concorrência",
          slug: "outro-hotel-concorrencia",
          city: "Manaus",
          description: "Empresa temporária para validar o isolamento entre empresas.",
          status: "published",
        })
      ).id;
      const foreignRoomId = (
        await saveRoom(pool, root, {
          company_id: otherHotelId,
          code: "O1",
          name: "Quarto de outra empresa",
          capacity: 2,
          price_cents: 30000,
          active: true,
        })
      ).id;
      await assert.rejects(
        companyInventory(pool, manager, otherHotelId),
        (error: unknown) => error instanceof HttpError && error.status === 403,
      );
      await assert.rejects(
        businessBookings(pool, manager, otherHotelId),
        (error: unknown) => error instanceof HttpError && error.status === 403,
      );
      await assert.rejects(
        saveRoom(pool, manager, {
          id: foreignRoomId,
          company_id: hotelId,
          code: "O1",
          name: "Tentativa de mover recurso",
          capacity: 2,
          price_cents: 1,
          active: true,
        }),
        (error: unknown) => error instanceof HttpError && error.status === 404,
      );

      const day = (offset: number) =>
        new Date(Date.parse(todayInManaus() + "T12:00:00Z") + offset * 86_400_000)
          .toISOString()
          .slice(0, 10);
      const capacityRequest = {
        kind: "hotel" as const,
        room_id: roomForCapacity,
        check_in: day(1),
        check_out: day(3),
        guests: 2,
        notes: "",
      };
      const capacityRequestKey = randomUUID();
      const capacityBooking = await requestBooking(
        pool,
        guest,
        capacityRequest,
        capacityRequestKey,
      );
      const duplicateCapacityBooking = await requestBooking(
        pool,
        guest,
        capacityRequest,
        capacityRequestKey,
      );
      assert.equal(
        duplicateCapacityBooking.id,
        capacityBooking.id,
        "retrying an idempotent booking request must return the original booking",
      );
      const requestNotifications = await pool.query<{
        user_id: string;
        event: string;
        count: number;
      }>(
        `SELECT user_id,event,count(*)::integer AS count
           FROM user_notifications
          WHERE booking_id=$1
          GROUP BY user_id,event
          ORDER BY user_id,event`,
        [capacityBooking.id],
      );
      assert.deepEqual(
        requestNotifications.rows,
        [manager.id, hotelStaff.id]
          .sort((left, right) => left.localeCompare(right))
          .map((user_id) => ({ user_id, event: "booking.requested", count: 1 })),
        "a new hotel booking notifies the manager and staff once, including after a retry",
      );
      const queuedEmails = await pool.query<{ user_id: string; event: string; status: string }>(
        `SELECT user_id,event,status
           FROM booking_email_outbox
          WHERE booking_id=$1
          ORDER BY user_id,event`,
        [capacityBooking.id],
      );
      assert.deepEqual(
        queuedEmails.rows,
        [manager.id, hotelStaff.id]
          .sort((left, right) => left.localeCompare(right))
          .map((user_id) => ({ user_id, event: "booking.requested", status: "pending" })),
        "the transactional email outbox stores the same authorized recipients in PostgreSQL",
      );
      await recordBookingEmailWorkerHeartbeat(pool, "running");
      const queuedOperations = await bookingEmailOperationsSummary(pool, root);
      assert.equal(queuedOperations.statuses.find(({ status }) => status === "pending")?.count, 2);
      assert.equal(queuedOperations.worker.state, "running");
      assert.equal(queuedOperations.failures.length, 0);
      const deliveredTeamEmails: BookingEmailMessage[] = [];
      for (let index = 0; index < 2; index++)
        assert.equal(
          await processNextBookingEmail(pool, async (message) => {
            deliveredTeamEmails.push(message);
          }),
          "sent",
        );
      assert.deepEqual(
        deliveredTeamEmails.map((message) => message.to).sort(),
        [manager.email, hotelStaff.email].sort(),
      );
      const roomRace = await runBehindRowLock(
        pool,
        adminPool,
        applicationName,
        "rooms",
        roomForCapacity,
        () =>
          decideBooking(pool!, manager, {
            company_id: hotelId,
            booking_id: capacityBooking.id,
            decision: "confirmed",
          }),
        () =>
          saveRoom(pool!, manager, {
            id: roomForCapacity,
            company_id: hotelId,
            code: "C1",
            name: "Quarto de capacidade",
            capacity: 1,
            price_cents: 25000,
            active: true,
          }),
      );
      assert.equal(roomRace[0].status, "fulfilled");
      assert.ok(
        isConflict(roomRace[1]),
        "reduzir a capacidade deve revalidar a reserva confirmada",
      );
      const customerConfirmation = await pool.query<{ count: number }>(
        `SELECT count(*)::integer AS count
           FROM user_notifications
          WHERE user_id=$1 AND company_id=$2 AND booking_id=$3 AND event='booking.confirmed'`,
        [guest.id, hotelId, capacityBooking.id],
      );
      assert.equal(
        customerConfirmation.rows[0].count,
        1,
        "confirming a booking in PostgreSQL notifies its customer exactly once",
      );
      const confirmationEmail = await pool.query<{ count: number }>(
        `SELECT count(*)::integer AS count
           FROM booking_email_outbox
          WHERE user_id=$1 AND company_id=$2 AND booking_id=$3
            AND event='booking.confirmed' AND status='pending'`,
        [guest.id, hotelId, capacityBooking.id],
      );
      assert.equal(confirmationEmail.rows[0].count, 1);
      let customerEmail: BookingEmailMessage | undefined;
      assert.equal(
        await processNextBookingEmail(pool, async (message) => {
          customerEmail = message;
        }),
        "sent",
      );
      assert.equal(customerEmail?.to, guest.email);
      assert.equal(customerEmail?.event, "booking.confirmed");
      await pool.query(
        `UPDATE booking_email_outbox
            SET status='failed',attempts=8,last_error_code='EUPSTREAM'
          WHERE booking_id=$1 AND event='booking.confirmed'`,
        [capacityBooking.id],
      );
      const failedOperations = await bookingEmailOperationsSummary(pool, root);
      assert.equal(failedOperations.statuses.find(({ status }) => status === "failed")?.count, 1);
      assert.deepEqual(failedOperations.failures, [
        {
          bookingId: capacityBooking.id,
          bookingReference: capacityBooking.id.slice(0, 8),
          event: "booking.confirmed",
          attempts: 8,
          lastErrorCode: "EUPSTREAM",
          recipientCount: 1,
          updatedAt: failedOperations.failures[0].updatedAt,
        },
      ]);
      assert.equal(await retryFailedBookingEmails(pool), 1);
      const reopenedEmail = await pool.query<{ status: string; attempts: number }>(
        `SELECT status,attempts FROM booking_email_outbox
          WHERE booking_id=$1 AND event='booking.confirmed'`,
        [capacityBooking.id],
      );
      assert.deepEqual(reopenedEmail.rows, [{ status: "pending", attempts: 0 }]);
      assert.equal(
        (
          await pool.query<{ capacity: number }>("SELECT capacity FROM rooms WHERE id=$1", [
            roomForCapacity,
          ])
        ).rows[0].capacity,
        2,
      );

      const stayBooking = await requestBooking(
        pool,
        guest,
        {
          kind: "hotel",
          room_id: roomForStay,
          check_in: day(0),
          check_out: day(1),
          guests: 1,
          notes: "",
        },
        randomUUID(),
      );
      await decideBooking(pool, manager, {
        company_id: hotelId,
        booking_id: stayBooking.id,
        decision: "confirmed",
      });
      const stayRace = await runBehindRowLock(
        pool,
        adminPool,
        applicationName,
        "rooms",
        roomForStay,
        () =>
          recordStay(pool!, manager, {
            company_id: hotelId,
            booking_id: stayBooking.id,
            action: "checkin",
            country: "Brasil",
            origin_city: "Manaus",
          }),
        () =>
          setRoomOperationalStatus(pool!, manager, {
            company_id: hotelId,
            room_id: roomForStay,
            operational_status: "cleaning",
          }),
      );
      assert.equal(stayRace[0].status, "fulfilled");
      assert.ok(isConflict(stayRace[1]), "quarto ocupado não pode mudar de situação operacional");
      assert.equal(
        (
          await pool.query<{ operational_status: string }>(
            "SELECT operational_status FROM rooms WHERE id=$1",
            [roomForStay],
          )
        ).rows[0].operational_status,
        "ready",
      );

      const operatorId = (
        await saveCompany(pool, root, {
          kind: "operator",
          name: "Operador de concorrência",
          slug: "operador-concorrencia",
          city: "Maués",
          description: "Operador temporário para validar operações simultâneas.",
          status: "published",
        })
      ).id;
      const tourId = (
        await saveTour(pool, root, {
          company_id: operatorId,
          slug: "passeio-concorrencia",
          name: "Passeio de concorrência",
          description: "Atividade temporária para validar capacidade.",
          city: "Maués",
          duration_minutes: 120,
          price_cents: 10000,
          guide_id: "",
          published: true,
        })
      ).id;
      const experienceSearch = await searchExperiences(pool, { q: "Passeio de concorrência" });
      assert.ok(
        experienceSearch.results.some(
          (result) => result.kind === "tour" && result.tour.id === tourId,
        ),
        "public experience search includes the published tour in PostgreSQL",
      );
      const multiTermSearch = await searchExperiences(pool, { q: "Maués Operador" });
      assert.ok(
        multiTermSearch.results.some(
          (result) => result.kind === "tour" && result.tour.id === tourId,
        ),
        "PostgreSQL search matches tour city and operator across separate fields",
      );
      const providerId = randomUUID();
      const createdAt = new Date().toISOString();
      await pool.query(
        `INSERT INTO catalog_items (id,category,name,slug,city,subtype,summary,description,details,status,created_at,updated_at)
         VALUES ($1,'guias','Guia Beatriz',$2,'Parintins','Guia de turismo','Atendimento em português e inglês.','Synthetic guide profile.','','published',$3,$3)`,
        [providerId, `guia-beatriz-${providerId}`, createdAt],
      );
      const providerSearch = await searchProviders(pool, "guias", { q: "Parintins Beatriz" });
      assert.ok(
        providerSearch.entries.some((entry) => entry.id === providerId),
        "PostgreSQL provider search matches all terms regardless of their field order",
      );
      const departureStartsAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
      const departureId = (
        await saveDeparture(pool, root, {
          company_id: operatorId,
          tour_id: tourId,
          starts_at: departureStartsAt,
          capacity: 2,
          active: true,
        })
      ).id;
      const tourBooking = await requestBooking(
        pool,
        guest,
        { kind: "tour", departure_id: departureId, guests: 2, notes: "" },
        randomUUID(),
      );
      const departureRace = await runBehindRowLock(
        pool,
        adminPool,
        applicationName,
        "departures",
        departureId,
        () =>
          decideBooking(pool!, root, {
            company_id: operatorId,
            booking_id: tourBooking.id,
            decision: "confirmed",
          }),
        () =>
          saveDeparture(pool!, root, {
            id: departureId,
            company_id: operatorId,
            tour_id: tourId,
            starts_at: departureStartsAt,
            capacity: 1,
            active: true,
          }),
      );
      assert.equal(departureRace[0].status, "fulfilled");
      assert.ok(isConflict(departureRace[1]), "a lotação não pode ficar abaixo das confirmações");
      assert.equal(
        (
          await pool.query<{ capacity: number }>("SELECT capacity FROM departures WHERE id=$1", [
            departureId,
          ])
        ).rows[0].capacity,
        2,
      );
      const reminderAt = new Date(Date.parse(departureStartsAt) - 24 * 60 * 60_000);
      assert.equal(await dispatchDueBookingReminders(pool, reminderAt), 1);
      assert.equal(await dispatchDueBookingReminders(pool, reminderAt), 0);
      const guestNotifications = await myNotificationsPage(pool, guest);
      assert.ok(
        guestNotifications.items.some(
          (notification) =>
            notification.booking_id === tourBooking.id && notification.event === "booking.reminder",
        ),
        "the PostgreSQL notification inbox includes the reminder exactly once",
      );
    } finally {
      try {
        await pool?.end();
        if (schemaCreated) await adminPool.query(`DROP SCHEMA "${schema}" CASCADE`);
      } finally {
        await adminPool.end();
        if (previousBookingEmailNotifications === undefined)
          delete process.env.BOOKING_EMAIL_NOTIFICATIONS;
        else process.env.BOOKING_EMAIL_NOTIFICATIONS = previousBookingEmailNotifications;
        if (previousSiteUrl === undefined) delete process.env.SITE_URL;
        else process.env.SITE_URL = previousSiteUrl;
      }
    }
  },
);
