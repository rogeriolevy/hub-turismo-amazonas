import type Database from "better-sqlite3";
import {
  companySchema,
  memberSchema,
  roomSchema,
  tourSchema,
  guideSchema,
  departureSchema,
  todayInManaus,
} from "../lib/platform-schema.ts";
import { one, many, parse, audit, write } from "./platform-store.ts";
import { companyAccess, requirePlatformAdmin } from "./platform-access.ts";
import { HttpError } from "./http.ts";
import type { Actor, Company, Room, Guide, Tour, Departure, Member } from "./platform-models.ts";

export function saveCompany(db: Database.Database, actor: Actor, input: unknown) {
  requirePlatformAdmin(actor);
  const data = parse(companySchema, input);
  const id = data.id || crypto.randomUUID();
  const old = data.id ? one<Company>(db, "SELECT * FROM companies WHERE id=?", data.id) : undefined;
  if (data.id) {
    if (!old) throw new HttpError(404, "NOT_FOUND", "Empresa não encontrada.");
    if (old.kind !== data.kind)
      throw new HttpError(409, "KIND", "O tipo da empresa não pode ser alterado.");
  }
  return write(db, () => {
    db.prepare(
      "INSERT INTO companies (id,kind,name,slug,city,description,status,created_at,trade_name) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,trade_name=excluded.trade_name,slug=excluded.slug,city=excluded.city,description=excluded.description,status=excluded.status",
    ).run(
      id,
      data.kind,
      data.name,
      data.slug,
      data.city,
      data.description,
      data.status,
      new Date().toISOString(),
      data.trade_name ?? old?.trade_name ?? "",
    );
    audit(db, actor.id, id, "company.saved", id);
    return { id };
  });
}
export function saveMember(db: Database.Database, actor: Actor, input: unknown) {
  requirePlatformAdmin(actor);
  const data = parse(memberSchema, input);
  const company = companyAccess(db, actor, data.company_id);
  if ((company.kind === "hotel") !== data.role.startsWith("hotel_"))
    throw new HttpError(422, "ROLE", "O perfil não pertence ao tipo desta empresa.");
  const user = one<Actor>(db, 'SELECT id,email,name FROM "user" WHERE email=?', data.email);
  if (!user)
    throw new HttpError(404, "USER", "Essa pessoa deve criar uma conta antes de receber acesso.");
  return write(db, () => {
    db.prepare(
      "INSERT INTO company_members VALUES (?,?,?) ON CONFLICT(company_id,user_id) DO UPDATE SET role=excluded.role",
    ).run(company.id, user.id, data.role);
    audit(db, actor.id, company.id, "member.granted", user.id);
    return { id: user.id };
  });
}
export function removeMember(
  db: Database.Database,
  actor: Actor,
  companyId: string,
  userId: string,
) {
  requirePlatformAdmin(actor);
  companyAccess(db, actor, companyId);
  return write(db, () => {
    db.prepare("DELETE FROM company_members WHERE company_id=? AND user_id=?").run(
      companyId,
      userId,
    );
    audit(db, actor.id, companyId, "member.revoked", userId);
    return { ok: true };
  });
}
export function listMembers(db: Database.Database, actor: Actor) {
  requirePlatformAdmin(actor);
  return many<Member & { company_name: string }>(
    db,
    `SELECT m.*,u.name,u.email,COALESCE(NULLIF(TRIM(c.trade_name),''),c.name) company_name FROM company_members m JOIN "user" u ON u.id=m.user_id JOIN companies c ON c.id=m.company_id ORDER BY company_name,u.name`,
  );
}
function own(
  db: Database.Database,
  table: "rooms" | "guides" | "tours",
  id: string | undefined,
  companyId: string,
) {
  if (id && !one(db, `SELECT id FROM ${table} WHERE id=? AND company_id=?`, id, companyId))
    throw new HttpError(404, "NOT_FOUND", "Registro não encontrado nesta empresa.");
}
export function saveRoom(db: Database.Database, actor: Actor, input: unknown) {
  const data = parse(roomSchema, input);
  companyAccess(db, actor, data.company_id, "hotel");
  own(db, "rooms", data.id, data.company_id);
  const id = data.id || crypto.randomUUID();
  return write(db, () => {
    if (
      one(
        db,
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
    db.prepare(
      "INSERT INTO rooms VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET code=excluded.code,name=excluded.name,capacity=excluded.capacity,price_cents=excluded.price_cents,active=excluded.active",
    ).run(
      id,
      data.company_id,
      data.code,
      data.name,
      data.capacity,
      data.price_cents,
      Number(data.active),
    );
    audit(db, actor.id, data.company_id, "room.saved", id);
    return { id };
  });
}
export function saveGuide(db: Database.Database, actor: Actor, input: unknown) {
  const data = parse(guideSchema, input);
  companyAccess(db, actor, data.company_id, "operator");
  own(db, "guides", data.id, data.company_id);
  const id = data.id || crypto.randomUUID();
  return write(db, () => {
    db.prepare(
      "INSERT INTO guides VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,name=excluded.name,bio=excluded.bio,languages=excluded.languages,published=excluded.published",
    ).run(
      id,
      data.company_id,
      data.slug,
      data.name,
      data.bio,
      data.languages,
      Number(data.published),
    );
    audit(db, actor.id, data.company_id, "guide.saved", id);
    return { id };
  });
}
export function saveTour(db: Database.Database, actor: Actor, input: unknown) {
  const data = parse(tourSchema, input);
  companyAccess(db, actor, data.company_id, "operator");
  own(db, "tours", data.id, data.company_id);
  if (data.guide_id) own(db, "guides", data.guide_id, data.company_id);
  const id = data.id || crypto.randomUUID();
  return write(db, () => {
    db.prepare(
      "INSERT INTO tours VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,name=excluded.name,description=excluded.description,city=excluded.city,duration_minutes=excluded.duration_minutes,price_cents=excluded.price_cents,guide_id=excluded.guide_id,published=excluded.published",
    ).run(
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
    audit(db, actor.id, data.company_id, "tour.saved", id);
    return { id };
  });
}
export function saveDeparture(db: Database.Database, actor: Actor, input: unknown) {
  const data = parse(departureSchema, input);
  companyAccess(db, actor, data.company_id, "operator");
  own(db, "tours", data.tour_id, data.company_id);
  if (Date.parse(data.starts_at) <= Date.now())
    throw new HttpError(422, "DATE", "A saída deve estar no futuro.");
  const old = data.id
    ? one<Departure>(
        db,
        "SELECT d.* FROM departures d JOIN tours t ON t.id=d.tour_id WHERE d.id=? AND t.company_id=?",
        data.id,
        data.company_id,
      )
    : undefined;
  if (data.id && !old) throw new HttpError(404, "NOT_FOUND", "Saída não encontrada.");
  const id = data.id || crypto.randomUUID();
  const startsAt = new Date(data.starts_at).toISOString();
  return write(db, () => {
    const booked = one<{ count: number; reserved: number }>(
      db,
      "SELECT COUNT(*) count,COALESCE(SUM(CASE WHEN status='confirmed' THEN guests ELSE 0 END),0) reserved FROM bookings WHERE departure_id=? AND status IN ('pending','confirmed')",
      id,
    )!;
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
    db.prepare(
      "INSERT INTO departures VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET tour_id=excluded.tour_id,starts_at=excluded.starts_at,capacity=excluded.capacity,active=excluded.active",
    ).run(id, data.tour_id, startsAt, data.capacity, Number(data.active));
    audit(db, actor.id, data.company_id, "departure.saved", id);
    return { id };
  });
}
export function companyInventory(db: Database.Database, actor: Actor, companyId: string) {
  const company = companyAccess(db, actor, companyId);
  return {
    company,
    rooms: many<Room>(db, "SELECT * FROM rooms WHERE company_id=? ORDER BY code", companyId),
    guides: many<Guide>(db, "SELECT * FROM guides WHERE company_id=? ORDER BY name", companyId),
    tours: many<Tour>(db, "SELECT * FROM tours WHERE company_id=? ORDER BY name", companyId),
    departures: many<Departure & { tour_name: string }>(
      db,
      "SELECT d.*,t.name tour_name,COALESCE((SELECT SUM(b.guests) FROM bookings b WHERE b.departure_id=d.id AND b.status='confirmed'),0) reserved FROM departures d JOIN tours t ON t.id=d.tour_id WHERE t.company_id=? ORDER BY d.starts_at DESC",
      companyId,
    ),
  };
}
