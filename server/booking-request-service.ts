import { createHash } from "node:crypto";
import { z } from "zod";
import { lockKey, type DatabaseExecutor } from "../db/index.ts";
import { bookingSchema } from "../lib/platform-schema/booking.ts";
import { todayInManaus } from "../lib/platform-schema/format.ts";
import { audit, one, parse, run, write } from "./platform-store.ts";
import { HttpError } from "./http.ts";
import type { Actor } from "./platform-models.ts";
import { notifyCompanyTeam } from "./notification-service.ts";
import {
  availableDeparture,
  availableRoom,
  roomAvailable,
  seatsAvailable,
} from "./booking-availability.ts";

export async function requestBooking(
  db: DatabaseExecutor,
  actor: Actor,
  input: unknown,
  requestKey: string,
) {
  const data = parse(bookingSchema, input);
  parse(z.string().uuid(), requestKey);
  const fingerprint = createHash("sha256").update(JSON.stringify(data)).digest("hex");
  return write(db, async (tx) => {
    await lockKey(tx, "booking:" + actor.id + ":" + requestKey);
    const duplicate = await one<{ id: string; fingerprint: string }>(
      tx,
      "SELECT id,fingerprint FROM bookings WHERE user_id=? AND request_key=?",
      actor.id,
      requestKey,
    );
    if (duplicate) {
      if (duplicate.fingerprint !== fingerprint)
        throw new HttpError(409, "IDEMPOTENCY", "Solicitação alterada. Envie novamente.");
      return { id: duplicate.id };
    }
    const count = (await one<{ n: number }>(
      tx,
      "SELECT CAST(COUNT(*) AS INTEGER) n FROM bookings WHERE user_id=? AND created_at>?",
      actor.id,
      new Date(Date.now() - 86400000).toISOString(),
    ))!.n;
    if (count >= 20)
      throw new HttpError(
        429,
        "LIMIT",
        "Limite diário de solicitações atingido. Tente novamente amanhã.",
      );
    let companyId: string, total: number;
    if (data.kind === "hotel") {
      const nights = (Date.parse(data.check_out) - Date.parse(data.check_in)) / 86400000;
      if (data.check_in < todayInManaus() || nights < 1 || nights > 30)
        throw new HttpError(422, "DATES", "Escolha uma estadia futura de 1 a 30 noites.");
      const room = await availableRoom(tx, data.room_id, true);
      if (data.guests > room.capacity)
        throw new HttpError(422, "CAPACITY", "O número de hóspedes excede a capacidade do quarto.");
      await roomAvailable(tx, room.id, data.check_in, data.check_out);
      companyId = room.company_id;
      total = room.price_cents * nights;
    } else {
      const departure = await availableDeparture(tx, data.departure_id, true);
      await seatsAvailable(tx, departure.id, departure.capacity, data.guests);
      companyId = departure.company_id;
      total = departure.price_cents * data.guests;
    }
    const id = crypto.randomUUID(),
      now = new Date().toISOString();
    await run(
      tx,
      "INSERT INTO bookings (id,request_key,fingerprint,user_id,company_id,kind,room_id,departure_id,check_in,check_out,guests,customer_name,customer_email,notes,total_cents,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',?,?)",
      id,
      requestKey,
      fingerprint,
      actor.id,
      companyId,
      data.kind,
      data.kind === "hotel" ? data.room_id : null,
      data.kind === "tour" ? data.departure_id : null,
      data.kind === "hotel" ? data.check_in : null,
      data.kind === "hotel" ? data.check_out : null,
      data.guests,
      actor.name,
      actor.email,
      data.notes,
      total,
      now,
      now,
    );
    await audit(tx, actor.id, companyId, "booking.requested", id);
    await notifyCompanyTeam(
      tx,
      companyId,
      data.kind === "hotel" ? "hotel" : "operator",
      id,
      "booking.requested",
      now,
    );
    return { id };
  });
}
