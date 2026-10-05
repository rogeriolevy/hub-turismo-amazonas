import type { DatabaseExecutor } from "../db/index.ts";
import {
  companySchema,
  companyActivityKinds,
  memberSchema,
  roomSchema,
  tourSchema,
  guideSchema,
  departureSchema,
  roomOperationalStatusSchema,
  todayInManaus,
} from "../lib/platform-schema.ts";
import { one, many, run, parse, audit, write } from "./platform-store.ts";
import { companyAccess, requirePlatformAdmin } from "./platform-access.ts";
import { HttpError } from "./http.ts";
import type {
  Actor,
  Company,
  OperationalRoom,
  Room,
  Guide,
  Tour,
  Departure,
  Member,
} from "./platform-models.ts";

export async function saveCompany(db: DatabaseExecutor, actor: Actor, input: unknown) {
  requirePlatformAdmin(actor);
  const data = parse(companySchema, input);
  const id = data.id || crypto.randomUUID();
  const old = data.id
    ? await one<Company>(db, "SELECT * FROM companies WHERE id=?", data.id)
    : undefined;
  if (data.id) {
    if (!old) throw new HttpError(404, "NOT_FOUND", "Empresa não encontrada.");
    if (old.kind !== data.kind)
      throw new HttpError(409, "KIND", "O tipo da empresa não pode ser alterado.");
  }
  const activityType =
    data.activity_type ?? old?.activity_type ?? (data.kind === "hotel" ? "hotel" : "passeios");
  if (companyActivityKinds[activityType] !== data.kind)
    throw new HttpError(422, "ACTIVITY_TYPE", "O tipo de atividade não corresponde à empresa.");
  return write(db, async (tx) => {
    await run(
      tx,
      "INSERT INTO companies (id,kind,activity_type,name,slug,city,description,status,created_at,trade_name) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET activity_type=excluded.activity_type,name=excluded.name,trade_name=excluded.trade_name,slug=excluded.slug,city=excluded.city,description=excluded.description,status=excluded.status",
      id,
      data.kind,
      activityType,
      data.name,
      data.slug,
      data.city,
      data.description,
      data.status,
      new Date().toISOString(),
      data.trade_name ?? old?.trade_name ?? "",
    );
    await audit(tx, actor.id, id, "company.saved", id);
    return { id };
  });
}

export async function saveMember(db: DatabaseExecutor, actor: Actor, input: unknown) {
  requirePlatformAdmin(actor);
  const data = parse(memberSchema, input);
  const company = await companyAccess(db, actor, data.company_id);
  if ((company.kind === "hotel") !== data.role.startsWith("hotel_"))
    throw new HttpError(422, "ROLE", "O perfil não pertence ao tipo desta empresa.");
  const user = await one<Actor>(db, 'SELECT id,email,name FROM "user" WHERE email=?', data.email);
  if (!user)
    throw new HttpError(404, "USER", "Essa pessoa deve criar uma conta antes de receber acesso.");
  return write(db, async (tx) => {
    await run(
      tx,
      "INSERT INTO company_members VALUES (?,?,?) ON CONFLICT(company_id,user_id) DO UPDATE SET role=excluded.role",
      company.id,
      user.id,
      data.role,
    );
    await audit(tx, actor.id, company.id, "member.granted", user.id);
    return { id: user.id };
  });
}

export async function removeMember(
  db: DatabaseExecutor,
  actor: Actor,
  companyId: string,
  userId: string,
) {
  requirePlatformAdmin(actor);
  await companyAccess(db, actor, companyId);
  return write(db, async (tx) => {
    await run(
      tx,
      "DELETE FROM company_members WHERE company_id=? AND user_id=?",
      companyId,
      userId,
    );
    await audit(tx, actor.id, companyId, "member.revoked", userId);
    return { ok: true };
  });
}

export async function listMembers(db: DatabaseExecutor, actor: Actor) {
  requirePlatformAdmin(actor);
  return many<Member & { company_name: string }>(
    db,
    `SELECT m.*,u.name,u.email,COALESCE(NULLIF(TRIM(c.trade_name),''),c.name) company_name FROM company_members m JOIN "user" u ON u.id=m.user_id JOIN companies c ON c.id=m.company_id ORDER BY company_name,u.name`,
  );
}

async function own(
  db: DatabaseExecutor,
  table: "rooms" | "guides" | "tours",
  id: string | undefined,
  companyId: string,
) {
  if (id && !(await one(db, `SELECT id FROM ${table} WHERE id=? AND company_id=?`, id, companyId)))
    throw new HttpError(404, "NOT_FOUND", "Registro não encontrado nesta empresa.");
}

export async function saveRoom(db: DatabaseExecutor, actor: Actor, input: unknown) {
  const data = parse(roomSchema, input);
  await companyAccess(db, actor, data.company_id, "hotel");
  await own(db, "rooms", data.id, data.company_id);
  const id = data.id || crypto.randomUUID();
  return write(db, async (tx) => {
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
  await companyAccess(db, actor, data.company_id, "hotel");
  return write(db, async (tx) => {
    const room = await one<Room>(
      tx,
      "SELECT * FROM rooms WHERE id=? AND company_id=?",
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

export async function saveGuide(db: DatabaseExecutor, actor: Actor, input: unknown) {
  const data = parse(guideSchema, input);
  await companyAccess(db, actor, data.company_id, "operator");
  await own(db, "guides", data.id, data.company_id);
  const id = data.id || crypto.randomUUID();
  return write(db, async (tx) => {
    await run(
      tx,
      "INSERT INTO guides VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,name=excluded.name,bio=excluded.bio,languages=excluded.languages,published=excluded.published",
      id,
      data.company_id,
      data.slug,
      data.name,
      data.bio,
      data.languages,
      Number(data.published),
    );
    await audit(tx, actor.id, data.company_id, "guide.saved", id);
    return { id };
  });
}

export async function saveTour(db: DatabaseExecutor, actor: Actor, input: unknown) {
  const data = parse(tourSchema, input);
  await companyAccess(db, actor, data.company_id, "operator");
  await own(db, "tours", data.id, data.company_id);
  if (data.guide_id) await own(db, "guides", data.guide_id, data.company_id);
  const id = data.id || crypto.randomUUID();
  return write(db, async (tx) => {
    await run(
      tx,
      "INSERT INTO tours VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,name=excluded.name,description=excluded.description,city=excluded.city,duration_minutes=excluded.duration_minutes,price_cents=excluded.price_cents,guide_id=excluded.guide_id,published=excluded.published",
      id,
      data.company_id,
      data.slug,
      data.name,
      data.description,
      data.city,
      data.duration_minutes,
      data.price_cents,
      data.guide_id,
      Number(data.published),
    );
    await audit(tx, actor.id, data.company_id, "tour.saved", id);
    return { id };
  });
}

export async function saveDeparture(db: DatabaseExecutor, actor: Actor, input: unknown) {
  const data = parse(departureSchema, input);
  await companyAccess(db, actor, data.company_id, "operator");
  await own(db, "tours", data.tour_id, data.company_id);
  if (Date.parse(data.starts_at) <= Date.now())
    throw new HttpError(422, "DATE", "A saída deve estar no futuro.");
  const old = data.id
    ? await one<Departure>(
        db,
        "SELECT d.* FROM departures d JOIN tours t ON t.id=d.tour_id WHERE d.id=? AND t.company_id=?",
        data.id,
        data.company_id,
      )
    : undefined;
  if (data.id && !old) throw new HttpError(404, "NOT_FOUND", "Saída não encontrada.");
  const id = data.id || crypto.randomUUID();
  const startsAt = new Date(data.starts_at).toISOString();
  return write(db, async (tx) => {
    const booked = (await one<{ count: number; reserved: number }>(
      tx,
      "SELECT CAST(COUNT(*) AS INTEGER) count,CAST(COALESCE(SUM(CASE WHEN status='confirmed' THEN guests ELSE 0 END),0) AS INTEGER) reserved FROM bookings WHERE departure_id=? AND status IN ('pending','confirmed')",
      id,
    ))!;
    if (booked.reserved > data.capacity)
      throw new HttpError(
        409,
        "CAPACITY",
        "A capacidade não pode ser menor que as vagas confirmadas.",
      );
    if (old && booked.count > 0 && (old.starts_at !== startsAt || old.tour_id !== data.tour_id))
      throw new HttpError(
        409,
        "DEPARTURE",
        "Uma saída com solicitações não pode mudar de passeio ou horário. Crie outra saída.",
      );
    await run(
      tx,
      "INSERT INTO departures VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET tour_id=excluded.tour_id,starts_at=excluded.starts_at,capacity=excluded.capacity,active=excluded.active",
      id,
      data.tour_id,
      startsAt,
      data.capacity,
      Number(data.active),
    );
    await audit(tx, actor.id, data.company_id, "departure.saved", id);
    return { id };
  });
}

export async function companyInventory(db: DatabaseExecutor, actor: Actor, companyId: string) {
  const company = await companyAccess(db, actor, companyId);
  const [rooms, guides, tours, departures] = await Promise.all([
    many<OperationalRoom>(
      db,
      `SELECT r.*,
        (SELECT b.customer_name FROM bookings b JOIN stay_records s ON s.booking_id=b.id
         WHERE b.room_id=r.id AND b.status='confirmed' AND s.checked_in_at IS NOT NULL AND s.checked_out_at IS NULL
         ORDER BY s.checked_in_at DESC LIMIT 1) AS current_guest,
        (SELECT b.check_out FROM bookings b JOIN stay_records s ON s.booking_id=b.id
         WHERE b.room_id=r.id AND b.status='confirmed' AND s.checked_in_at IS NOT NULL AND s.checked_out_at IS NULL
         ORDER BY s.checked_in_at DESC LIMIT 1) AS current_departure
       FROM rooms r WHERE r.company_id=? ORDER BY r.code`,
      companyId,
    ),
    many<Guide>(db, "SELECT * FROM guides WHERE company_id=? ORDER BY name", companyId),
    many<Tour>(db, "SELECT * FROM tours WHERE company_id=? ORDER BY name", companyId),
    many<Departure & { tour_name: string }>(
      db,
      "SELECT d.*,t.name tour_name,CAST(COALESCE((SELECT SUM(b.guests) FROM bookings b WHERE b.departure_id=d.id AND b.status='confirmed'),0) AS INTEGER) reserved FROM departures d JOIN tours t ON t.id=d.tour_id WHERE t.company_id=? ORDER BY d.starts_at DESC",
      companyId,
    ),
  ]);
  return { company, rooms, guides, tours, departures };
}
