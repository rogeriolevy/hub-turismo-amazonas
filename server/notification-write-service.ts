import { z } from "zod";
import type { DatabaseExecutor } from "../db/index.ts";
import { many, parse, run, write } from "./platform-store.ts";
import type { Actor } from "./platform-models.ts";
import { enqueueBookingEmailNotification } from "./booking-email-queue-service.ts";
import type { NotificationEvent } from "./notification-model.ts";

type StoredNotificationEvent = Exclude<NotificationEvent, "booking.reminder">;

async function createNotification(
  db: DatabaseExecutor,
  userId: string,
  companyId: string,
  bookingId: string,
  event: StoredNotificationEvent,
  createdAt: string,
) {
  const result = await run(
    db,
    "INSERT INTO user_notifications (id,user_id,company_id,booking_id,event,created_at,read_at) VALUES (?,?,?,?,?,?,NULL) ON CONFLICT(user_id,booking_id,event) DO NOTHING",
    crypto.randomUUID(),
    userId,
    companyId,
    bookingId,
    event,
    createdAt,
  );
  if (result.changes > 0)
    await enqueueBookingEmailNotification(db, userId, companyId, bookingId, event, createdAt);
}

export async function notifyCompanyTeam(
  db: DatabaseExecutor,
  companyId: string,
  companyKind: "hotel" | "operator",
  bookingId: string,
  event: "booking.requested" | "booking.cancelled",
  createdAt: string,
) {
  const roles = companyKind === "hotel" ? "'hotel_manager','hotel_staff'" : "'operator'";
  const members = await many<{ user_id: string }>(
    db,
    `SELECT user_id FROM company_members WHERE company_id=? AND role IN (${roles}) ORDER BY user_id`,
    companyId,
  );
  for (const member of members)
    await createNotification(db, member.user_id, companyId, bookingId, event, createdAt);
}

export async function notifyBookingCustomer(
  db: DatabaseExecutor,
  userId: string,
  companyId: string,
  bookingId: string,
  event: "booking.confirmed" | "booking.declined",
  createdAt: string,
) {
  await createNotification(db, userId, companyId, bookingId, event, createdAt);
}

export async function markNotificationRead(db: DatabaseExecutor, actor: Actor, input: unknown) {
  const { notification_id: id } = parse(
    z.object({ notification_id: z.string().uuid() }).strict(),
    input,
  );
  return write(db, async (tx) => {
    const now = new Date().toISOString();
    const stored = await run(
      tx,
      "UPDATE user_notifications SET read_at=? WHERE id=? AND user_id=? AND read_at IS NULL",
      now,
      id,
      actor.id,
    );
    const reminder = await run(
      tx,
      "UPDATE booking_reminders SET read_at=? WHERE id=? AND user_id=? AND read_at IS NULL",
      now,
      id,
      actor.id,
    );
    return { updated: stored.changes + reminder.changes > 0 };
  });
}

export async function markAllNotificationsRead(db: DatabaseExecutor, actor: Actor) {
  return write(db, async (tx) => {
    const now = new Date().toISOString();
    const stored = await run(
      tx,
      "UPDATE user_notifications SET read_at=? WHERE user_id=? AND read_at IS NULL",
      now,
      actor.id,
    );
    const reminders = await run(
      tx,
      "UPDATE booking_reminders SET read_at=? WHERE user_id=? AND read_at IS NULL",
      now,
      actor.id,
    );
    return { updated: stored.changes + reminders.changes };
  });
}
