import type Database from "better-sqlite3";
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
export function companiesFor(db: Database.Database, actor: Actor) {
  return isPlatformAdmin(actor)
    ? many<Company>(
        db,
        "SELECT * FROM companies ORDER BY COALESCE(NULLIF(TRIM(trade_name),''),name),id",
      )
    : many<Company>(
        db,
        "SELECT c.* FROM companies c JOIN company_members m ON m.company_id=c.id WHERE m.user_id=? AND c.status!='suspended' ORDER BY COALESCE(NULLIF(TRIM(c.trade_name),''),c.name),c.id",
        actor.id,
      );
}
export function companyAccess(
  db: Database.Database,
  actor: Actor,
  companyId: string,
  kind?: Company["kind"],
) {
  const company = one<Company>(db, "SELECT * FROM companies WHERE id=?", companyId);
  if (!company || (kind && company.kind !== kind))
    throw new HttpError(404, "NOT_FOUND", "Empresa não encontrada.");
  if (!isPlatformAdmin(actor)) {
    const member = one<Member>(
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
