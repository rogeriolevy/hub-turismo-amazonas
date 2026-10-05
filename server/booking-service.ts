import { lockKey, lockSuffix, type DatabaseExecutor } from "../db/index.ts";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  bookingSchema,
  decisionSchema,
  staySchema,
  todayInManaus,
} from "../lib/platform-schema.ts";
import { one, many, run, parse, audit, write } from "./platform-store.ts";
import { companyAccess } from "./platform-access.ts";
import { HttpError } from "./http.ts";
import type { Actor, Room, Booking, Departure } from "./platform-models.ts";

const bookingQuery = `SELECT b.*,COALESCE(NULLIF(TRIM(c.trade_name),''),c.name) company_name,COALESCE(r.name,t.name) item_name,d.starts_at,s.country,s.origin_city,s.checked_in_at,s.checked_out_at FROM bookings b JOIN companies c ON c.id=b.company_id LEFT JOIN rooms r ON r.id=b.room_id LEFT JOIN departures d ON d.id=b.departure_id LEFT JOIN tours t ON t.id=d.tour_id LEFT JOIN stay_records s ON s.booking_id=b.id`;

export function myBookings(db: DatabaseExecutor, actor: Actor) {
  return many<Booking>(
    db,
    bookingQuery + " WHERE b.user_id=? ORDER BY b.created_at DESC",
    actor.id,
  );
}

export async function businessBookings(db: DatabaseExecutor, actor: Actor, companyId: string) {
  await companyAccess(db, actor, companyId);
  return many<Booking>(
    db,
    bookingQuery + " WHERE b.company_id=? ORDER BY b.created_at DESC",
    companyId,
  );
}

async function roomAvailable(
  db: DatabaseExecutor,
  roomId: string,
  start: string,
  end: string,
  except = "",
) {
  if (
    await one(
      db,
      "SELECT id FROM bookings WHERE room_id=? AND status='confirmed' AND check_in<? AND check_out>? AND id!=?",
      roomId,
      end,
      start,
      except,
    )
  )
    throw new HttpError(
      409,
      "UNAVAILABLE",
      "O quarto já tem uma reserva confirmada nesse período.",
    );
}

async function seatsAvailable(
  db: DatabaseExecutor,
  departureId: string,
  capacity: number,
  guests: number,
  except = "",
) {
  const used = (await one<{ n: number }>(
    db,
    "SELECT CAST(COALESCE(SUM(guests),0) AS INTEGER) n FROM bookings WHERE departure_id=? AND status='confirmed' AND id!=?",
    departureId,
    except,
  ))!.n;
  if (used + guests > capacity)
    throw new HttpError(409, "UNAVAILABLE", "Essa saída não tem vagas suficientes.");
}

async function availableRoom(db: DatabaseExecutor, id: string, lock = false) {
  const room = await one<Room>(
    db,
    "SELECT r.* FROM rooms r JOIN companies c ON c.id=r.company_id WHERE r.id=? AND r.active=1 AND r.operational_status='ready' AND c.status='published'" +
      (lock ? lockSuffix(db, "r") : ""),
    id,
  );
  if (!room) throw new HttpError(404, "NOT_FOUND", "Quarto indisponível para solicitações.");
  return room;
}

async function availableDeparture(db: DatabaseExecutor, id: string, lock = false) {
  const departure = await one<Departure & { company_id: string; price_cents: number }>(
    db,
    "SELECT d.*,t.company_id,t.price_cents FROM departures d JOIN tours t ON t.id=d.tour_id JOIN companies c ON c.id=t.company_id WHERE d.id=? AND d.active=1 AND t.published=1 AND c.status='published'" +
      (lock ? lockSuffix(db, "d") : ""),
    id,
  );
  if (!departure || departure.starts_at <= new Date().toISOString())
    throw new HttpError(409, "UNAVAILABLE", "Essa saída não está disponível.");
  return departure;
}

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
    return { id };
  });
}

export async function decideBooking(db: DatabaseExecutor, actor: Actor, input: unknown) {
  const data = parse(decisionSchema, input);
  await companyAccess(db, actor, data.company_id);
  return write(db, async (tx) => {
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
    await run(
      tx,
      "UPDATE bookings SET status=?,updated_at=? WHERE id=?",
      data.decision,
      new Date().toISOString(),
      booking.id,
    );
    await audit(tx, actor.id, data.company_id, "booking." + data.decision, booking.id);
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
    await run(
      tx,
      "UPDATE bookings SET status='cancelled',updated_at=? WHERE id=?",
      new Date().toISOString(),
      id,
    );
    await audit(tx, actor.id, booking.company_id, "booking.cancelled", id);
    return { id };
  });
}

export async function recordStay(db: DatabaseExecutor, actor: Actor, input: unknown) {
  const data = parse(staySchema, input);
  await companyAccess(db, actor, data.company_id, "hotel");
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
