import { lockSuffix, type DatabaseExecutor } from "../db/index.ts";
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
  const result = await write(db, async (tx) => {
    const old = data.id
      ? await one<Company>(tx, `SELECT * FROM companies WHERE id=?${lockSuffix(tx)}`, data.id)
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
    const tradeName = data.trade_name ?? old?.trade_name ?? "";
    const publicFieldsChanged = Boolean(
      old &&
        old.status === "published" &&
        data.status === "published" &&
        ((old.name ?? "").trim() !== data.name ||
          (old.trade_name ?? "").trim() !== tradeName.trim() ||
          (old.slug ?? "") !== data.slug ||
          (old.city ?? "").trim() !== data.city ||
          (old.description ?? "").trim() !== data.description ||
          (old.activity_type ?? (old.kind === "hotel" ? "hotel" : "passeios")) !== activityType),
    );
    const confirmationRequired =
      data.status === "published" && (!old || old.status !== "published" || publicFieldsChanged);
    if (confirmationRequired && data.provider_data_confirmed !== true)
      throw new HttpError(
        422,
        "PROVIDER_CONFIRMATION_REQUIRED",
        "Confirme que os dados atuais foram revisados com o prestador antes de publicar ou alterar as informações públicas.",
      );
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
      tradeName,
    );
    if (confirmationRequired) await audit(tx, actor.id, id, "company.publish_confirmed", id);
    await audit(tx, actor.id, id, "company.saved", id);
    return { id };
  });
  invalidatePublicDirectoryCache(db);
  return result;
}
