import { lockSuffix, type DatabaseExecutor } from "../db/index.ts";
import { tourSchema, guideSchema, departureSchema } from "../lib/platform-schema/inventory.ts";
import { one, run, parse, audit, write } from "./platform-store.ts";
import { companyAccess } from "./platform-access.ts";
import { HttpError } from "./http.ts";
import type { Actor, Departure } from "./platform-models.ts";
import { invalidatePublicDirectoryCache } from "./cadastur/public-directory-cache.ts";

async function own(
  db: DatabaseExecutor,
  table: "guides" | "tours",
  id: string | undefined,
  companyId: string,
) {
  if (id && !(await one(db, `SELECT id FROM ${table} WHERE id=? AND company_id=?`, id, companyId)))
    throw new HttpError(404, "NOT_FOUND", "Registro não encontrado nesta empresa.");
}

export async function saveGuide(db: DatabaseExecutor, actor: Actor, input: unknown) {
  const data = parse(guideSchema, input);
  await companyAccess(db, actor, data.company_id, "operator", "operator.catalog.manage");
  await own(db, "guides", data.id, data.company_id);
  const id = data.id || crypto.randomUUID();
  const result = await write(db, async (tx) => {
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
  invalidatePublicDirectoryCache(db);
  return result;
}

export async function saveTour(db: DatabaseExecutor, actor: Actor, input: unknown) {
  const data = parse(tourSchema, input);
  await companyAccess(db, actor, data.company_id, "operator", "operator.catalog.manage");
  await own(db, "tours", data.id, data.company_id);
  if (data.guide_id) await own(db, "guides", data.guide_id, data.company_id);
  const id = data.id || crypto.randomUUID();
  const result = await write(db, async (tx) => {
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
  invalidatePublicDirectoryCache(db);
  return result;
}

export async function saveDeparture(db: DatabaseExecutor, actor: Actor, input: unknown) {
  const data = parse(departureSchema, input);
  await companyAccess(db, actor, data.company_id, "operator", "operator.schedule.manage");
  await own(db, "tours", data.tour_id, data.company_id);
  if (Date.parse(data.starts_at) <= Date.now())
    throw new HttpError(422, "DATE", "A saída deve estar no futuro.");
  const id = data.id || crypto.randomUUID();
  const startsAt = new Date(data.starts_at).toISOString();
  return write(db, async (tx) => {
    const old = data.id
      ? await one<Departure>(
          tx,
          "SELECT d.* FROM departures d JOIN tours t ON t.id=d.tour_id WHERE d.id=? AND t.company_id=?" +
            lockSuffix(tx, "d"),
          data.id,
          data.company_id,
        )
      : undefined;
    if (data.id && !old) throw new HttpError(404, "NOT_FOUND", "Saída não encontrada.");
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
