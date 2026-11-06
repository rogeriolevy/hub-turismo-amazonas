import { lockSuffix, type DatabaseExecutor } from "../db/index.ts";
import { one } from "./platform-store.ts";
import { HttpError } from "./http.ts";
import type { Room, Departure } from "./platform-models.ts";

export async function roomAvailable(
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

export async function seatsAvailable(
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

export async function availableRoom(db: DatabaseExecutor, id: string, lock = false) {
  const room = await one<Room>(
    db,
    "SELECT r.* FROM rooms r JOIN companies c ON c.id=r.company_id WHERE r.id=? AND r.active=1 AND r.operational_status='ready' AND c.status='published'" +
      (lock ? lockSuffix(db, "r") : ""),
    id,
  );
  if (!room) throw new HttpError(404, "NOT_FOUND", "Quarto indisponível para solicitações.");
  return room;
}

export async function availableDeparture(db: DatabaseExecutor, id: string, lock = false) {
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
