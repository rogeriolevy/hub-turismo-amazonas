import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import { openDatabase } from "../db/index.ts";
import { migrateDatabase } from "../db/migrate-auth.ts";
import { todayInManaus } from "../lib/platform-schema.ts";
import { decideBooking, requestBooking, cancelBooking } from "../server/booking-service.ts";
import { saveCompany, saveDeparture, saveRoom, saveTour } from "../server/company-service.ts";
import {
  bookingReminderDueAt,
  bookingReminderStartAt,
  dispatchDueBookingReminders,
} from "../server/booking-reminders.ts";
import {
  markAllNotificationsRead,
  markNotificationRead,
  myNotificationsPage,
} from "../server/notification-service.ts";
import type { Actor } from "../server/platform-models.ts";

function day(offset: number) {
  return new Date(Date.parse(`${todayInManaus()}T12:00:00.000Z`) + offset * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

test("confirmed bookings create one private in-app reminder at the configured schedule", async () => {
  const previousEnvironment = {
    adminEmails: process.env.ADMIN_EMAILS,
    authSecret: process.env.BETTER_AUTH_SECRET,
    bookingEmailNotifications: process.env.BOOKING_EMAIL_NOTIFICATIONS,
    siteUrl: process.env.SITE_URL,
  };
  process.env.ADMIN_EMAILS = "root@booking-reminder.test";
  process.env.BETTER_AUTH_SECRET = randomBytes(48).toString("base64url");
  process.env.BOOKING_EMAIL_NOTIFICATIONS = "false";
  process.env.SITE_URL = "https://hub.example.test";

  const db = openDatabase(":memory:");
  try {
    await migrateDatabase(db);
    const now = new Date().toISOString();
    const user = (email: string, name: string): Actor => {
      const actor = { id: randomUUID(), email, name };
      db.prepare(
        'INSERT INTO "user" (id,name,email,emailVerified,createdAt,updatedAt) VALUES (?,?,?,1,?,?)',
      ).run(actor.id, actor.name, actor.email, now, now);
      return actor;
    };
    const root = user("root@booking-reminder.test", "Administração");
    const tourist = user("tourist@booking-reminder.test", "Turista");
    const hotel = await saveCompany(db, root, {
      kind: "hotel",
      name: "Hotel lembrete",
      slug: "hotel-lembrete",
      city: "Manaus",
      description: "Hotel fictício para validar avisos de reserva.",
      status: "published",
    });
    const room = await saveRoom(db, root, {
      company_id: hotel.id,
      code: "L1",
      name: "Quarto de teste",
      capacity: 2,
      price_cents: 20_000,
      active: true,
    });
    const tourCompany = await saveCompany(db, root, {
      kind: "operator",
      name: "Operador lembrete",
      slug: "operador-lembrete",
      city: "Manaus",
      description: "Operador fictício para validar avisos de reserva.",
      status: "published",
    });
    const tour = await saveTour(db, root, {
      company_id: tourCompany.id,
      slug: "passeio-lembrete",
      name: "Passeio de teste",
      description: "Experiência fictícia para validar avisos.",
      city: "Manaus",
      duration_minutes: 90,
      price_cents: 5_000,
      guide_id: "",
      published: true,
    });
    const departureStartsAt = new Date(Date.now() + 8 * 86_400_000).toISOString();
    const departure = await saveDeparture(db, root, {
      company_id: tourCompany.id,
      tour_id: tour.id,
      starts_at: departureStartsAt,
      capacity: 4,
      active: true,
    });

    const hotelBooking = await requestBooking(
      db,
      tourist,
      {
        kind: "hotel",
        room_id: room.id,
        check_in: day(5),
        check_out: day(6),
        guests: 1,
        notes: "",
      },
      randomUUID(),
    );
    await decideBooking(db, root, {
      company_id: hotel.id,
      booking_id: hotelBooking.id,
      decision: "confirmed",
    });

    const hotelStart = bookingReminderStartAt({
      kind: "hotel",
      check_in: day(5),
      starts_at: null,
    });
    const hotelDue = bookingReminderDueAt({ kind: "hotel", check_in: day(5), starts_at: null });
    assert.ok(hotelStart && hotelDue);
    assert.equal(hotelStart.toISOString(), new Date(`${day(5)}T09:00:00-04:00`).toISOString());
    assert.equal(hotelDue.getTime(), hotelStart.getTime() - 24 * 60 * 60_000);
    assert.equal(
      await dispatchDueBookingReminders(db, new Date(hotelDue.getTime() - 1)),
      0,
      "the hotel reminder is not created before its due time",
    );
    assert.equal(await dispatchDueBookingReminders(db, hotelDue), 1);
    assert.equal(
      await dispatchDueBookingReminders(db, hotelDue),
      0,
      "repeated worker polls do not duplicate reminders",
    );

    const lateToday = new Date(`${day(0)}T18:00:00.000-04:00`);
    const insertConfirmedHotel = db.prepare(
      `INSERT INTO bookings
       (id,request_key,fingerprint,user_id,company_id,kind,room_id,departure_id,check_in,check_out,
        guests,customer_name,customer_email,notes,total_cents,status,created_at,updated_at)
       VALUES (?,?,?,?,?,'hotel',?,NULL,?,?,1,?,?, '',20000,'confirmed',?,?)`,
    );
    for (let index = 0; index < 200; index += 1) {
      const id = randomUUID();
      insertConfirmedHotel.run(
        id,
        randomUUID(),
        `stale-${index}`,
        root.id,
        hotel.id,
        room.id,
        day(0),
        day(1),
        root.name,
        root.email,
        now,
        now,
      );
    }
    const tomorrowBookingId = randomUUID();
    insertConfirmedHotel.run(
      tomorrowBookingId,
      randomUUID(),
      "valid-tomorrow",
      root.id,
      hotel.id,
      room.id,
      day(1),
      day(2),
      root.name,
      root.email,
      now,
      now,
    );
    assert.equal(
      await dispatchDueBookingReminders(db, lateToday),
      1,
      "expired same-day hotel candidates do not starve due reminders in a full batch",
    );
    assert.equal(
      (
        db
          .prepare("SELECT count(*) AS count FROM booking_reminders WHERE booking_id=?")
          .get(tomorrowBookingId) as { count: number }
      ).count,
      1,
      "the future hotel reminder is created despite a full batch of expired candidates",
    );

    const tourBooking = await requestBooking(
      db,
      tourist,
      { kind: "tour", departure_id: departure.id, guests: 1, notes: "" },
      randomUUID(),
    );
    await decideBooking(db, root, {
      company_id: tourCompany.id,
      booking_id: tourBooking.id,
      decision: "confirmed",
    });
    const tourDue = new Date(Date.parse(departureStartsAt) - 24 * 60 * 60_000);
    assert.equal(await dispatchDueBookingReminders(db, tourDue), 1);

    const cancelledBooking = await requestBooking(
      db,
      tourist,
      {
        kind: "hotel",
        room_id: room.id,
        check_in: day(8),
        check_out: day(9),
        guests: 1,
        notes: "",
      },
      randomUUID(),
    );
    await decideBooking(db, root, {
      company_id: hotel.id,
      booking_id: cancelledBooking.id,
      decision: "confirmed",
    });
    await cancelBooking(db, tourist, cancelledBooking.id);
    const cancelledDue = bookingReminderDueAt({
      kind: "hotel",
      check_in: day(8),
      starts_at: null,
    });
    assert.ok(cancelledDue);
    assert.equal(
      await dispatchDueBookingReminders(db, cancelledDue),
      0,
      "cancelled reservations do not generate reminders",
    );

    const inbox = await myNotificationsPage(db, tourist);
    const reminders = inbox.items.filter((item) => item.event === "booking.reminder");
    assert.equal(reminders.length, 2);
    assert.deepEqual(
      new Set(reminders.map((item) => item.booking_id)),
      new Set([hotelBooking.id, tourBooking.id]),
    );
    assert.equal(inbox.unreadCount, inbox.total);
    assert.equal(
      (db.prepare("SELECT count(*) AS count FROM booking_email_outbox").get() as { count: number })
        .count,
      0,
      "reminders stay in-app while transactional email remains disabled",
    );

    const firstReminder = reminders[0];
    assert.deepEqual(
      await markNotificationRead(db, tourist, { notification_id: firstReminder.id }),
      { updated: true },
    );
    assert.deepEqual(
      await markNotificationRead(db, tourist, { notification_id: firstReminder.id }),
      { updated: false },
    );
    const afterSingleRead = await myNotificationsPage(db, tourist);
    assert.equal(afterSingleRead.unreadCount, inbox.unreadCount - 1);
    const markedAll = await markAllNotificationsRead(db, tourist);
    assert.equal(markedAll.updated, afterSingleRead.unreadCount);
    assert.equal((await myNotificationsPage(db, tourist)).unreadCount, 0);
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
