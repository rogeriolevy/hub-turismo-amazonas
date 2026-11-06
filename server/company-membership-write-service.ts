import type { DatabaseExecutor } from "../db/index.ts";
import { memberSchema } from "../lib/platform-schema/company.ts";
import { one, run, parse, audit, write } from "./platform-store.ts";
import { companyAccess, requirePlatformAdmin } from "./platform-access.ts";
import { HttpError } from "./http.ts";
import type { Actor } from "./platform-models.ts";

export async function saveMember(db: DatabaseExecutor, actor: Actor, input: unknown) {
  requirePlatformAdmin(actor);
  const data = parse(memberSchema, input);
  const company = await companyAccess(db, actor, data.company_id);
  if ((company.kind === "hotel") !== data.role.startsWith("hotel_"))
    throw new HttpError(422, "ROLE", "O perfil não pertence ao tipo desta empresa.");
  const guideId = data.role === "guide" ? data.guide_id : null;
  if (data.role === "guide" && !guideId)
    throw new HttpError(422, "GUIDE", "Vincule o perfil público do guia à conta.");
  if (guideId) {
    const guide = await one<{ id: string }>(
      db,
      "SELECT id FROM guides WHERE id=? AND company_id=?",
      guideId,
      company.id,
    );
    if (!guide)
      throw new HttpError(422, "GUIDE", "O perfil do guia deve pertencer à mesma operadora.");
  }
  const user = await one<Actor>(db, 'SELECT id,email,name FROM "user" WHERE email=?', data.email);
  if (!user)
    throw new HttpError(404, "USER", "Essa pessoa deve criar uma conta antes de receber acesso.");
  return write(db, async (tx) => {
    await run(
      tx,
      "INSERT INTO company_members (company_id,user_id,role,guide_id) VALUES (?,?,?,?) ON CONFLICT(company_id,user_id) DO UPDATE SET role=excluded.role,guide_id=excluded.guide_id",
      company.id,
      user.id,
      data.role,
      guideId,
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
