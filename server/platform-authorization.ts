import { lockSuffix, type DatabaseExecutor } from "../db/index.ts";
import { isAdmin } from "./authorization.ts";
import { HttpError } from "./http.ts";
import { one } from "./platform-store.ts";
import type { Actor, Company, Member } from "./platform-models.ts";

export type CompanyPermission =
  | "hotel.read"
  | "hotel.rooms.manage"
  | "hotel.rooms.operate"
  | "hotel.bookings.manage"
  | "hotel.stays.manage"
  | "operator.catalog.manage"
  | "operator.schedule.manage"
  | "operator.bookings.manage"
  | "operator.schedule.own.read";

const rolePermissions: Record<Member["role"], readonly CompanyPermission[]> = {
  hotel_manager: [
    "hotel.read",
    "hotel.rooms.manage",
    "hotel.rooms.operate",
    "hotel.bookings.manage",
    "hotel.stays.manage",
  ],
  hotel_staff: ["hotel.read", "hotel.rooms.operate", "hotel.bookings.manage", "hotel.stays.manage"],
  operator: ["operator.catalog.manage", "operator.schedule.manage", "operator.bookings.manage"],
  guide: ["operator.schedule.own.read"],
};

export function isPlatformAdmin(actor: Actor) {
  return isAdmin(actor.email, process.env.ADMIN_EMAILS);
}

export function requirePlatformAdmin(actor: Actor) {
  if (!isPlatformAdmin(actor))
    throw new HttpError(403, "FORBIDDEN", "Acesso exclusivo da administração da plataforma.");
}

export async function companyMember(
  db: DatabaseExecutor,
  actor: Actor,
  companyId: string,
  lockForUpdate = false,
) {
  return one<Member>(
    db,
    "SELECT * FROM company_members WHERE company_id=? AND user_id=?" +
      (lockForUpdate ? lockSuffix(db) : ""),
    companyId,
    actor.id,
  );
}

export async function companyRole(db: DatabaseExecutor, actor: Actor, companyId: string) {
  if (isPlatformAdmin(actor)) return null;
  return (await companyMember(db, actor, companyId))?.role ?? null;
}

export async function companyAccess(
  db: DatabaseExecutor,
  actor: Actor,
  companyId: string,
  kind?: Company["kind"],
  permission?: CompanyPermission,
  options: { lockForUpdate?: boolean } = {},
) {
  const company = await one<Company>(
    db,
    "SELECT * FROM companies WHERE id=?" + (options.lockForUpdate ? lockSuffix(db) : ""),
    companyId,
  );
  if (!company || (kind && company.kind !== kind))
    throw new HttpError(404, "NOT_FOUND", "Empresa não encontrada.");
  if (!isPlatformAdmin(actor)) {
    const member = await companyMember(db, actor, company.id, options.lockForUpdate);
    if (!member || company.status === "suspended")
      throw new HttpError(403, "FORBIDDEN", "Sua conta não tem acesso a esta empresa.");
    const roleMatchesCompany =
      company.kind === "hotel"
        ? member.role === "hotel_manager" || member.role === "hotel_staff"
        : member.role === "operator" || member.role === "guide";
    if (!roleMatchesCompany)
      throw new HttpError(403, "FORBIDDEN", "O perfil da conta não corresponde a esta empresa.");
    if (permission && !rolePermissions[member.role].includes(permission))
      throw new HttpError(403, "FORBIDDEN", "Seu perfil não permite esta operação.");
    if (permission === "operator.schedule.own.read") {
      if (!member.guide_id)
        throw new HttpError(
          403,
          "FORBIDDEN",
          "Peça à administração para vincular sua conta ao cadastro do guia.",
        );
      const linkedGuide = await one<{ id: string }>(
        db,
        "SELECT id FROM guides WHERE id=? AND company_id=?",
        member.guide_id,
        company.id,
      );
      if (!linkedGuide)
        throw new HttpError(
          403,
          "FORBIDDEN",
          "O cadastro vinculado não pertence a esta operadora; peça à administração para corrigir o acesso.",
        );
    }
  }
  return company;
}
