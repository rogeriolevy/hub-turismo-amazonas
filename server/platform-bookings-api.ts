import { z } from "zod";
import type { DatabaseExecutor } from "../db/index.ts";
import { json } from "./http.ts";
import { parse } from "./platform-store.ts";
import type { Actor } from "./platform-models.ts";
import {
  businessBookings,
  businessBookingsPage,
  myBookings,
  myBookingsPage,
} from "./booking-read-service.ts";
import {
  cancelBooking,
  decideBooking,
  recordStay,
  requestBooking,
} from "./booking-write-service.ts";

export async function getPlatformBookings(
  db: DatabaseExecutor,
  actor: Actor,
  path: string,
  companyId: string,
  page: string | null,
) {
  if (path === "minhas-reservas") {
    if (page !== null) {
      const result = await myBookingsPage(db, actor, page);
      return json({
        data: result.items,
        meta: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          totalPages: result.totalPages,
        },
      });
    }
    return json({ data: await myBookings(db, actor) });
  }

  if (path === "reservas") {
    if (page !== null) {
      const result = await businessBookingsPage(db, actor, companyId, page);
      return json({
        data: result.items,
        meta: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          totalPages: result.totalPages,
        },
      });
    }
    return json({ data: await businessBookings(db, actor, companyId) });
  }

  return null;
}

export async function postPlatformBooking(
  db: DatabaseExecutor,
  actor: Actor,
  path: string,
  body: unknown,
  idempotencyKey: string,
) {
  if (path === "reservas")
    return json({ data: await requestBooking(db, actor, body, idempotencyKey) }, 201);

  if (path === "decisao") return json({ data: await decideBooking(db, actor, body) });

  if (path === "estadia") return json({ data: await recordStay(db, actor, body) });

  if (path === "cancelar") {
    const input = parse(z.object({ booking_id: z.string().uuid() }).strict(), body);
    return json({ data: await cancelBooking(db, actor, input.booking_id) });
  }

  return null;
}
