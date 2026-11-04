import type { DatabaseExecutor } from "../db/index.ts";
import { one, many } from "./platform-store.ts";
import { requirePlatformAdmin } from "./platform-access.ts";
import type { Actor } from "./platform-models.ts";
import { HttpError } from "./http.ts";
import { z } from "zod";

const PAGE_SIZE = 25;
const uuid = z.string().uuid();

export type AuditEntry = {
  id: string;
  actor_id: string;
  actor_name: string;
  actor_email: string;
  company_id: string | null;
  company_name: string | null;
  action: string;
  entity_id: string;
  created_at: string;
};

export async function listAuditEntries(
  db: DatabaseExecutor,
  actor: Actor,
  options: { companyId?: string; page?: string | number } = {},
) {
  requirePlatformAdmin(actor);

  const companyId = options.companyId?.trim() || undefined;
  if (companyId && !uuid.safeParse(companyId).success)
    throw new HttpError(422, "VALIDATION", "Empresa inválida para consulta da auditoria.");

  const requestedPage = Number(options.page ?? 1);
  const safePage = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const where = companyId ? " WHERE a.company_id=?" : "";
  const values = companyId ? [companyId] : [];
  const count = await one<{ total: number | string }>(
    db,
    `SELECT COUNT(*) AS total FROM platform_audit a${where}`,
    ...values,
  );
  const total = Number(count?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(safePage, totalPages);
  const entries = await many<AuditEntry>(
    db,
    `SELECT a.id,a.actor_id,u.name AS actor_name,u.email AS actor_email,
            a.company_id,CASE WHEN a.company_id IS NULL THEN NULL
              ELSE COALESCE(NULLIF(TRIM(c.trade_name),''),c.name) END AS company_name,
            a.action,a.entity_id,a.created_at
       FROM platform_audit a
       JOIN "user" u ON u.id=a.actor_id
       LEFT JOIN companies c ON c.id=a.company_id${where}
      ORDER BY a.created_at DESC,a.id DESC
      LIMIT ? OFFSET ?`,
    ...values,
    PAGE_SIZE,
    (page - 1) * PAGE_SIZE,
  );

  return { entries, companyId, page, pageSize: PAGE_SIZE, total, totalPages };
}
