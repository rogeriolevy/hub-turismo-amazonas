import type { DatabaseExecutor } from "../db/index.ts";
import { many, one } from "./platform-store.ts";
import type { Actor } from "./platform-models.ts";
import type { UserNotification, UserNotificationPage } from "./notification-model.ts";

const NOTIFICATION_PAGE_SIZE = 20;
const notificationListQuery = `SELECT n.id,n.event,n.company_id,c.kind AS company_kind,n.booking_id,
                                      b.kind AS booking_kind,n.created_at,n.read_at
                                 FROM (
                                   SELECT id,event,company_id,booking_id,created_at,read_at
                                     FROM user_notifications WHERE user_id=?
                                   UNION ALL
                                   SELECT id,'booking.reminder' AS event,company_id,booking_id,created_at,read_at
                                     FROM booking_reminders WHERE user_id=?
                                 ) n
                                 JOIN companies c ON c.id=n.company_id
                                 JOIN bookings b ON b.id=n.booking_id`;

export async function unreadNotificationCount(db: DatabaseExecutor, actor: Actor) {
  const row = await one<{ count: number | string }>(
    db,
    `SELECT CAST(COUNT(*) AS INTEGER) AS count FROM (
       SELECT read_at FROM user_notifications WHERE user_id=?
       UNION ALL
       SELECT read_at FROM booking_reminders WHERE user_id=?
     ) notifications WHERE read_at IS NULL`,
    actor.id,
    actor.id,
  );
  return Number(row?.count ?? 0);
}

export async function myNotifications(db: DatabaseExecutor, actor: Actor) {
  const [items, unreadCount] = await Promise.all([
    many<UserNotification>(
      db,
      notificationListQuery + " ORDER BY n.created_at DESC,n.id DESC LIMIT 100",
      actor.id,
      actor.id,
    ),
    unreadNotificationCount(db, actor),
  ]);
  return { items, unreadCount };
}

export async function myNotificationsPage(
  db: DatabaseExecutor,
  actor: Actor,
  requestedPage?: string | number,
): Promise<UserNotificationPage> {
  const parsedPage = Number(requestedPage ?? 1);
  const safePage = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const count = await one<{ total: number | string }>(
    db,
    `SELECT COUNT(*) AS total FROM (
       SELECT id FROM user_notifications WHERE user_id=?
       UNION ALL
       SELECT id FROM booking_reminders WHERE user_id=?
     ) notifications`,
    actor.id,
    actor.id,
  );
  const total = Number(count?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / NOTIFICATION_PAGE_SIZE));
  const page = Math.min(safePage, totalPages);
  const [items, unreadCount] = await Promise.all([
    many<UserNotification>(
      db,
      notificationListQuery + " ORDER BY n.created_at DESC,n.id DESC LIMIT ? OFFSET ?",
      actor.id,
      actor.id,
      NOTIFICATION_PAGE_SIZE,
      (page - 1) * NOTIFICATION_PAGE_SIZE,
    ),
    unreadNotificationCount(db, actor),
  ]);
  return { items, unreadCount, page, pageSize: NOTIFICATION_PAGE_SIZE, total, totalPages };
}
