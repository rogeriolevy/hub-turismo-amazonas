import { lockSuffix, type DatabaseExecutor } from "../db/index.ts";
import { staySchema } from "../lib/platform-schema/booking.ts";
import { todayInManaus } from "../lib/platform-schema/format.ts";
import { audit, one, parse, run, write } from "./platform-store.ts";
import { companyAccess } from "./platform-access.ts";
import { HttpError } from "./http.ts";
import type { Actor, Booking } from "./platform-models.ts";
import { bookingQuery } from "./booking-query.ts";

export async function recordStay(db: DatabaseExecutor, actor: Actor, input: unknown) {
  const data = parse(staySchema, input);
  await companyAccess(db, actor, data.company_id, "hotel", "hotel.stays.manage");
  return write(db, async (tx) => {
    const booking = await one<Booking>(
      tx,
      bookingQuery + " WHERE b.id=? AND b.company_id=? AND b.kind='hotel'" + lockSuffix(tx, "b"),
      data.booking_id,
      data.company_id,
    );
    if (!booking || booking.status !== "confirmed")
      throw new HttpError(409, "STATUS", "A estadia exige uma reserva confirmada.");
    const now = new Date().toISOString();
    if (data.action === "checkin") {
      if (booking.checked_in_at) throw new HttpError(409, "STATUS", "Check-in já registrado.");
      const today = todayInManaus();
      if (today < booking.check_in! || today >= booking.check_out!)
        throw new HttpError(409, "DATE", "Registre a chegada durante o período da reserva.");
      const room = await one<{ operational_status: string }>(
        tx,
        "SELECT operational_status FROM rooms WHERE id=? AND company_id=?" + lockSuffix(tx),
        booking.room_id!,
        data.company_id,
      );
      if (!room || room.operational_status !== "ready")
        throw new HttpError(
          409,
          "ROOM_STATUS",
          "Marque o quarto como pronto antes de registrar o check-in.",
        );
      await run(
        tx,
        "INSERT INTO stay_records VALUES (?,?,?,?,NULL)",
        booking.id,
        data.country,
        data.origin_city,
        now,
      );
    } else {
      if (!booking.checked_in_at || booking.checked_out_at)
        throw new HttpError(409, "STATUS", "Confira o check-in antes de registrar a saída.");
      await run(tx, "UPDATE stay_records SET checked_out_at=? WHERE booking_id=?", now, booking.id);
      await run(
        tx,
        "UPDATE rooms SET operational_status='cleaning' WHERE id=? AND company_id=?",
        booking.room_id,
        data.company_id,
      );
    }
    await audit(tx, actor.id, data.company_id, "stay." + data.action, booking.id);
    return { id: booking.id };
  });
}
