import type { DatabaseExecutor } from "../db/index.ts";
import { companySchema, companyActivityKinds } from "../lib/platform-schema/company.ts";
import { one, run, parse, audit, write } from "./platform-store.ts";
import { requirePlatformAdmin } from "./platform-access.ts";
import { HttpError } from "./http.ts";
import type { Actor, Company } from "./platform-models.ts";
import { invalidatePublicDirectoryCache } from "./cadastur/public-directory-cache.ts";

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
  const result = await write(db, async (tx) => {
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
  invalidatePublicDirectoryCache(db);
  return result;
}
