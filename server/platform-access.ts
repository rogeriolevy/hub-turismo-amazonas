import type { DatabaseExecutor } from "../db/index.ts";
import { isAdmin } from "./authorization.ts";
import { HttpError } from "./http.ts";
import { one, many } from "./platform-store.ts";
import type { Actor, Company, Member } from "./platform-models.ts";
export function isPlatformAdmin(actor: Actor) {
  return isAdmin(actor.email, process.env.ADMIN_EMAILS);
}
export function requirePlatformAdmin(actor: Actor) {
  if (!isPlatformAdmin(actor))
    throw new HttpError(403, "FORBIDDEN", "Acesso exclusivo da administração da plataforma.");
}
export async function companiesFor(db: DatabaseExecutor, actor: Actor) {
  return isPlatformAdmin(actor)
    ? await many<Company>(
        db,
        "SELECT * FROM companies ORDER BY COALESCE(NULLIF(TRIM(trade_name),''),name),id",
      )
    : await many<Company>(
        db,
        "SELECT c.* FROM companies c JOIN company_members m ON m.company_id=c.id WHERE m.user_id=? AND c.status!='suspended' ORDER BY COALESCE(NULLIF(TRIM(c.trade_name),''),c.name),c.id",
        actor.id,
      );
}
export async function companyAccess(
  db: DatabaseExecutor,
  actor: Actor,
  companyId: string,
  kind?: Company["kind"],
) {
  const company = await one<Company>(db, "SELECT * FROM companies WHERE id=?", companyId);
  if (!company || (kind && company.kind !== kind))
    throw new HttpError(404, "NOT_FOUND", "Empresa não encontrada.");
  if (!isPlatformAdmin(actor)) {
    const member = await one<Member>(
      db,
      "SELECT * FROM company_members WHERE company_id=? AND user_id=?",
      company.id,
      actor.id,
    );
    if (!member || company.status === "suspended")
      throw new HttpError(403, "FORBIDDEN", "Sua conta não tem acesso a esta empresa.");
  }
  return company;
}
