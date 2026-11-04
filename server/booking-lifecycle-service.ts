import { lockSuffix, type DatabaseExecutor } from "../db/index.ts";
import { z } from "zod";
import { decisionSchema } from "../lib/platform-schema/booking.ts";
import { todayInManaus } from "../lib/platform-schema/format.ts";
import { audit, one, parse, run, write } from "./platform-store.ts";
import { companyAccess } from "./platform-access.ts";
import { HttpError } from "./http.ts";
import type { Actor, Booking } from "./platform-models.ts";
import { notifyBookingCustomer, notifyCompanyTeam } from "./notification-service.ts";
import { bookingQuery } from "./booking-query.ts";
import {
  availableDeparture,
  availableRoom,
  roomAvailable,
  seatsAvailable,
} from "./booking-availability.ts";

export async function decideBooking(db: DatabaseExecutor, actor: Actor, input: unknown) {
  const data = parse(decisionSchema, input);
  return write(db, async (tx) => {
    const company = await companyAccess(tx, actor, data.company_id, undefined, undefined, {
      lockForUpdate: true,
    });
    await companyAccess(
      tx,
      actor,
      data.company_id,
      company.kind,
      company.kind === "hotel" ? "hotel.bookings.manage" : "operator.bookings.manage",
      { lockForUpdate: true },
    );
    const booking = await one<Booking>(
      tx,
      "SELECT * FROM bookings WHERE id=? AND company_id=?" + lockSuffix(tx),
      data.booking_id,
      data.company_id,
    );
    if (!booking) throw new HttpError(404, "NOT_FOUND", "Solicitação não encontrada.");
    if (booking.status !== "pending")
      throw new HttpError(409, "STATUS", "Esta solicitação já foi analisada ou cancelada.");
    if (data.decision === "confirmed") {
      if (booking.kind === "hotel") {
        const room = await availableRoom(tx, booking.room_id!, true);
        if (booking.check_in! < todayInManaus() || room.capacity < booking.guests)
          throw new HttpError(
            409,
            "UNAVAILABLE",
            "Verifique as datas e a capacidade antes de aprovar.",
          );
        await roomAvailable(tx, room.id, booking.check_in!, booking.check_out!, booking.id);
      } else {
        const departure = await availableDeparture(tx, booking.departure_id!, true);
        await seatsAvailable(tx, departure.id, departure.capacity, booking.guests, booking.id);
      }
    }
    const now = new Date().toISOString();
    await run(
      tx,
      "UPDATE bookings SET status=?,updated_at=? WHERE id=?",
      data.decision,
      now,
      booking.id,
    );
    await audit(tx, actor.id, data.company_id, "booking." + data.decision, booking.id);
    const event = data.decision === "confirmed" ? "booking.confirmed" : "booking.declined";
    await notifyBookingCustomer(tx, booking.user_id, booking.company_id, booking.id, event, now);
    return { id: booking.id };
  });
}

export async function cancelBooking(db: DatabaseExecutor, actor: Actor, id: string) {
  parse(z.string().uuid(), id);
  return write(db, async (tx) => {
    const booking = await one<Booking>(
      tx,
      bookingQuery + " WHERE b.id=? AND b.user_id=?" + lockSuffix(tx, "b"),
      id,
      actor.id,
    );
    if (!booking) throw new HttpError(404, "NOT_FOUND", "Reserva não encontrada.");
    if (!["pending", "confirmed"].includes(booking.status))
      throw new HttpError(409, "STATUS", "Essa reserva já está encerrada.");
    if (
      booking.checked_in_at ||
      (booking.kind === "hotel"
        ? booking.check_in! < todayInManaus()
        : booking.starts_at! <= new Date().toISOString())
    )
      throw new HttpError(409, "STARTED", "A atividade já começou. Fale com o responsável.");
    const now = new Date().toISOString();
    await run(tx, "UPDATE bookings SET status='cancelled',updated_at=? WHERE id=?", now, id);
    if (booking.status === "confirmed") {
      await run(
        tx,
        "DELETE FROM booking_reminders WHERE booking_id=? AND user_id=?",
        booking.id,
        booking.user_id,
      );
    }
    await audit(tx, actor.id, booking.company_id, "booking.cancelled", id);
    await notifyCompanyTeam(
      tx,
      booking.company_id,
      booking.kind === "hotel" ? "hotel" : "operator",
      booking.id,
      "booking.cancelled",
      now,
    );
    return { id };
  });
}

export { recordStay } from "./booking-stay-service.ts";
