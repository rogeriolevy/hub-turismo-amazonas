import type Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  bookingSchema,
  decisionSchema,
  staySchema,
  todayInManaus,
} from "../lib/platform-schema.ts";
import { one, many, parse, audit, write } from "./platform-store.ts";
import { companyAccess } from "./platform-access.ts";
import { HttpError } from "./http.ts";
import type { Actor, Room, Booking, Departure } from "./platform-models.ts";

const bookingQuery = `SELECT b.*,COALESCE(NULLIF(TRIM(c.trade_name),''),c.name) company_name,COALESCE(r.name,t.name) item_name,d.starts_at,s.country,s.origin_city,s.checked_in_at,s.checked_out_at FROM bookings b JOIN companies c ON c.id=b.company_id LEFT JOIN rooms r ON r.id=b.room_id LEFT JOIN departures d ON d.id=b.departure_id LEFT JOIN tours t ON t.id=d.tour_id LEFT JOIN stay_records s ON s.booking_id=b.id`;
export function myBookings(db: Database.Database, actor: Actor) {
  return many<Booking>(
    db,
    bookingQuery + " WHERE b.user_id=? ORDER BY b.created_at DESC",
    actor.id,
  );
}
export function businessBookings(db: Database.Database, actor: Actor, companyId: string) {
  companyAccess(db, actor, companyId);
  return many<Booking>(
    db,
    bookingQuery + " WHERE b.company_id=? ORDER BY b.created_at DESC",
    companyId,
  );
}
function roomAvailable(
  db: Database.Database,
  roomId: string,
  start: string,
  end: string,
  except = "",
) {
  if (
    one(
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
function seatsAvailable(
  db: Database.Database,
  departureId: string,
  capacity: number,
  guests: number,
  except = "",
) {
  const used = one<{ n: number }>(
    db,
    "SELECT COALESCE(SUM(guests),0) n FROM bookings WHERE departure_id=? AND status='confirmed' AND id!=?",
    departureId,
    except,
  )!.n;
  if (used + guests > capacity)
    throw new HttpError(409, "UNAVAILABLE", "Essa saída não tem vagas suficientes.");
}
function availableRoom(db: Database.Database, id: string) {
  const room = one<Room>(
    db,
    "SELECT r.* FROM rooms r JOIN companies c ON c.id=r.company_id WHERE r.id=? AND r.active=1 AND c.status='published'",
    id,
  );
  if (!room) throw new HttpError(404, "NOT_FOUND", "Quarto indisponível para solicitações.");
  return room;
}
function availableDeparture(db: Database.Database, id: string) {
  const departure = one<Departure & { company_id: string; price_cents: number }>(
    db,
    "SELECT d.*,t.company_id,t.price_cents FROM departures d JOIN tours t ON t.id=d.tour_id JOIN companies c ON c.id=t.company_id WHERE d.id=? AND d.active=1 AND t.published=1 AND c.status='published'",
    id,
  );
  if (!departure || departure.starts_at <= new Date().toISOString())
    throw new HttpError(409, "UNAVAILABLE", "Essa saída não está disponível.");
  return departure;
}
export function requestBooking(
  db: Database.Database,
  actor: Actor,
  input: unknown,
  requestKey: string,
) {
  const data = parse(bookingSchema, input);
  parse(z.string().uuid(), requestKey);
  const fingerprint = createHash("sha256").update(JSON.stringify(data)).digest("hex");
  return write(db, () => {
    const duplicate = one<{ id: string; fingerprint: string }>(
      db,
      "SELECT id,fingerprint FROM bookings WHERE user_id=? AND request_key=?",
      actor.id,
      requestKey,
    );
    if (duplicate) {
      if (duplicate.fingerprint !== fingerprint)
        throw new HttpError(409, "IDEMPOTENCY", "Solicitação alterada. Envie novamente.");
      return { id: duplicate.id };
    }
    const count = one<{ n: number }>(
      db,
      "SELECT COUNT(*) n FROM bookings WHERE user_id=? AND created_at>?",
      actor.id,
      new Date(Date.now() - 86400000).toISOString(),
    )!.n;
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
      const room = availableRoom(db, data.room_id);
      if (data.guests > room.capacity)
        throw new HttpError(422, "CAPACITY", "O número de hóspedes excede a capacidade do quarto.");
      roomAvailable(db, room.id, data.check_in, data.check_out);
      companyId = room.company_id;
      total = room.price_cents * nights;
    } else {
      const departure = availableDeparture(db, data.departure_id);
      seatsAvailable(db, departure.id, departure.capacity, data.guests);
      companyId = departure.company_id;
      total = departure.price_cents * data.guests;
    }
    const id = crypto.randomUUID(),
      now = new Date().toISOString();
    db.prepare(
      "INSERT INTO bookings (id,request_key,fingerprint,user_id,company_id,kind,room_id,departure_id,check_in,check_out,guests,customer_name,customer_email,notes,total_cents,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',?,?)",
    ).run(
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
    audit(db, actor.id, companyId, "booking.requested", id);
    return { id };
  });
}
export function decideBooking(db: Database.Database, actor: Actor, input: unknown) {
  const data = parse(decisionSchema, input);
  companyAccess(db, actor, data.company_id);
  return write(db, () => {
    const booking = one<Booking>(
      db,
      "SELECT * FROM bookings WHERE id=? AND company_id=?",
      data.booking_id,
      data.company_id,
    );
    if (!booking) throw new HttpError(404, "NOT_FOUND", "Solicitação não encontrada.");
    if (booking.status !== "pending")
      throw new HttpError(409, "STATUS", "Esta solicitação já foi analisada ou cancelada.");
    if (data.decision === "confirmed") {
      if (booking.kind === "hotel") {
        const room = availableRoom(db, booking.room_id!);
        if (booking.check_in! < todayInManaus() || room.capacity < booking.guests)
          throw new HttpError(
            409,
            "UNAVAILABLE",
            "Verifique as datas e a capacidade antes de aprovar.",
          );
        roomAvailable(db, room.id, booking.check_in!, booking.check_out!, booking.id);
      } else {
        const departure = availableDeparture(db, booking.departure_id!);
        seatsAvailable(db, departure.id, departure.capacity, booking.guests, booking.id);
      }
    }
    db.prepare("UPDATE bookings SET status=?,updated_at=? WHERE id=?").run(
      data.decision,
      new Date().toISOString(),
      booking.id,
    );
    audit(db, actor.id, data.company_id, "booking." + data.decision, booking.id);
    return { id: booking.id };
  });
}
export function cancelBooking(db: Database.Database, actor: Actor, id: string) {
  parse(z.string().uuid(), id);
  return write(db, () => {
    const booking = one<Booking>(db, bookingQuery + " WHERE b.id=? AND b.user_id=?", id, actor.id);
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
    db.prepare("UPDATE bookings SET status='cancelled',updated_at=? WHERE id=?").run(
      new Date().toISOString(),
      id,
    );
    audit(db, actor.id, booking.company_id, "booking.cancelled", id);
    return { id };
  });
}
export function recordStay(db: Database.Database, actor: Actor, input: unknown) {
  const data = parse(staySchema, input);
  companyAccess(db, actor, data.company_id, "hotel");
  return write(db, () => {
    const booking = one<Booking>(
      db,
      bookingQuery + " WHERE b.id=? AND b.company_id=? AND b.kind='hotel'",
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
      db.prepare("INSERT INTO stay_records VALUES (?,?,?,?,NULL)").run(
        booking.id,
        data.country,
        data.origin_city,
        now,
      );
    } else {
      if (!booking.checked_in_at || booking.checked_out_at)
        throw new HttpError(409, "STATUS", "Confira o check-in antes de registrar a saída.");
      db.prepare("UPDATE stay_records SET checked_out_at=? WHERE booking_id=?").run(
        now,
        booking.id,
      );
    }
    audit(db, actor.id, data.company_id, "stay." + data.action, booking.id);
    return { id: booking.id };
  });
}
