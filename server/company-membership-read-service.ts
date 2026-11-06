import type { DatabaseExecutor } from "../db/index.ts";
import { many, one } from "./platform-store.ts";
import { requirePlatformAdmin } from "./platform-access.ts";
import type { Actor, Member } from "./platform-models.ts";

const MEMBER_PAGE_SIZE = 20;

export type MembersPage = {
  items: Array<Member & { company_name: string; guide_name: string | null }>;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export async function listMembers(db: DatabaseExecutor, actor: Actor) {
  requirePlatformAdmin(actor);
  return many<Member & { company_name: string; guide_name: string | null }>(
    db,
    `SELECT m.*,u.name,u.email,g.name guide_name,COALESCE(NULLIF(TRIM(c.trade_name),''),c.name) company_name FROM company_members m JOIN "user" u ON u.id=m.user_id JOIN companies c ON c.id=m.company_id LEFT JOIN guides g ON g.id=m.guide_id ORDER BY company_name,u.name,m.company_id,m.user_id`,
  );
}

async function memberPage(
  db: DatabaseExecutor,
  requestedPage?: string | number,
): Promise<MembersPage> {
  const parsedPage = Number(requestedPage ?? 1);
  const safePage = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const count = await one<{ total: number | string }>(
    db,
    "SELECT COUNT(*) AS total FROM company_members",
  );
  const total = Number(count?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / MEMBER_PAGE_SIZE));
  const page = Math.min(safePage, totalPages);
  const items = await many<Member & { company_name: string; guide_name: string | null }>(
    db,
    `SELECT m.*,u.name,u.email,g.name guide_name,COALESCE(NULLIF(TRIM(c.trade_name),''),c.name) company_name
       FROM company_members m
       JOIN "user" u ON u.id=m.user_id
       JOIN companies c ON c.id=m.company_id
       LEFT JOIN guides g ON g.id=m.guide_id
      ORDER BY company_name,u.name,m.company_id,m.user_id
      LIMIT ? OFFSET ?`,
    MEMBER_PAGE_SIZE,
    (page - 1) * MEMBER_PAGE_SIZE,
  );
  return { items, page, pageSize: MEMBER_PAGE_SIZE, total, totalPages };
}

export async function listMembersPage(
  db: DatabaseExecutor,
  actor: Actor,
  requestedPage?: string | number,
): Promise<MembersPage> {
  requirePlatformAdmin(actor);
  return memberPage(db, requestedPage);
}

export async function countMembers(db: DatabaseExecutor, actor: Actor) {
  requirePlatformAdmin(actor);
  const result = await one<{ total: number | string }>(
    db,
    "SELECT COUNT(*) AS total FROM company_members",
  );
  return Number(result?.total ?? 0);
}
