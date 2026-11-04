import { lockSuffix, type DatabaseExecutor } from "../db/index.ts";
import { roomSchema, roomOperationalStatusSchema } from "../lib/platform-schema/inventory.ts";
import { todayInManaus } from "../lib/platform-schema/format.ts";
import { one, run, parse, audit, write } from "./platform-store.ts";
import { companyAccess } from "./platform-access.ts";
import { HttpError } from "./http.ts";
import type { Actor, Room } from "./platform-models.ts";

export async function saveRoom(db: DatabaseExecutor, actor: Actor, input: unknown) {
  const data = parse(roomSchema, input);
  await companyAccess(db, actor, data.company_id, "hotel", "hotel.rooms.manage");
  const id = data.id || crypto.randomUUID();
  return write(db, async (tx) => {
    if (data.id) {
      const existing = await one<{ id: string }>(
        tx,
        "SELECT id FROM rooms WHERE id=? AND company_id=?" + lockSuffix(tx),
        data.id,
        data.company_id,
      );
      if (!existing)
        throw new HttpError(404, "NOT_FOUND", "Registro não encontrado nesta empresa.");
    }
    if (
      await one(
        tx,
        "SELECT id FROM bookings WHERE room_id=? AND status='confirmed' AND check_out>? AND guests>?",
        id,
        todayInManaus(),
        data.capacity,
      )
    )
      throw new HttpError(
        409,
        "CAPACITY",
        "Há reservas confirmadas com mais hóspedes do que essa capacidade.",
      );
    await run(
      tx,
      "INSERT INTO rooms (id,company_id,code,name,capacity,price_cents,active) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET code=excluded.code,name=excluded.name,capacity=excluded.capacity,price_cents=excluded.price_cents,active=excluded.active",
      id,
      data.company_id,
      data.code,
      data.name,
      data.capacity,
      data.price_cents,
      Number(data.active),
    );
    await audit(tx, actor.id, data.company_id, "room.saved", id);
    return { id };
  });
}

export async function setRoomOperationalStatus(db: DatabaseExecutor, actor: Actor, input: unknown) {
  const data = parse(roomOperationalStatusSchema, input);
  await companyAccess(db, actor, data.company_id, "hotel", "hotel.rooms.operate");
  return write(db, async (tx) => {
    const room = await one<Room>(
      tx,
      "SELECT * FROM rooms WHERE id=? AND company_id=?" + lockSuffix(tx),
      data.room_id,
      data.company_id,
    );
    if (!room) throw new HttpError(404, "NOT_FOUND", "Quarto não encontrado nesta hospedagem.");
    const currentStay = await one<{ id: string }>(
      tx,
      "SELECT b.id FROM bookings b JOIN stay_records s ON s.booking_id=b.id WHERE b.room_id=? AND b.status='confirmed' AND s.checked_in_at IS NOT NULL AND s.checked_out_at IS NULL LIMIT 1",
      room.id,
    );
    if (currentStay)
      throw new HttpError(
        409,
        "OCCUPIED",
        "O quarto está ocupado. Registre o check-out para atualizar sua situação.",
      );
    if (room.operational_status === data.operational_status) return { id: room.id };
    await run(
      tx,
      "UPDATE rooms SET operational_status=? WHERE id=? AND company_id=?",
      data.operational_status,
      room.id,
      data.company_id,
    );
    await audit(tx, actor.id, data.company_id, "room.status_changed", room.id);
    return { id: room.id, operational_status: data.operational_status };
  });
}
