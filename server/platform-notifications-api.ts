import { z } from "zod";
import type { DatabaseExecutor } from "../db/index.ts";
import { json } from "./http.ts";
import { parse } from "./platform-store.ts";
import type { Actor } from "./platform-models.ts";
import {
  markAllNotificationsRead,
  markNotificationRead,
  myNotifications,
  myNotificationsPage,
} from "./notification-service.ts";

export async function getPlatformNotifications(
  db: DatabaseExecutor,
  actor: Actor,
  page: string | null,
) {
  if (page !== null) {
    const result = await myNotificationsPage(db, actor, page);
    return json({
      data: result.items,
      unreadCount: result.unreadCount,
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  }

  const notifications = await myNotifications(db, actor);
  return json({ data: notifications.items, unreadCount: notifications.unreadCount });
}

export async function postPlatformNotification(
  db: DatabaseExecutor,
  actor: Actor,
  path: string,
  body: unknown,
) {
  if (path === "notificacoes/lida")
    return json({ data: await markNotificationRead(db, actor, body) });

  if (path === "notificacoes/ler-todas") {
    parse(z.object({}).strict(), body);
    return json({ data: await markAllNotificationsRead(db, actor) });
  }

  return null;
}
