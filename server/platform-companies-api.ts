import { z } from "zod";
import type { DatabaseExecutor } from "../db/index.ts";
import { json } from "./http.ts";
import { parse } from "./platform-store.ts";
import type { Actor } from "./platform-models.ts";
import { companyOptionsPage, companiesFor, companiesPageFor } from "./platform-access.ts";
import { saveCompany, guideOptionsPage } from "./company-service.ts";
import {
  saveMember,
  removeMember,
  listMembers,
  listMembersPage,
} from "./company-membership-service.ts";

export async function getPlatformCompanies(
  db: DatabaseExecutor,
  actor: Actor,
  path: string,
  url: URL,
) {
  const page = url.searchParams.get("page");

  if (path === "empresas") {
    if (page !== null) {
      const result = await companiesPageFor(db, actor, page);
      return json({
        data: result.items,
        meta: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          totalPages: result.totalPages,
        },
      });
    }
    return json({ data: await companiesFor(db, actor) });
  }

  if (path === "opcoes-empresas") {
    const result = await companyOptionsPage(db, actor, {
      q: url.searchParams.get("q") ?? "",
      page: page ?? undefined,
      selectedId: url.searchParams.get("selected") ?? undefined,
      kind: url.searchParams.get("kind") ?? undefined,
    });
    return json({
      data: result.items,
      selected: result.selected,
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  }

  if (path === "opcoes-guias") {
    const result = await guideOptionsPage(db, actor, {
      q: url.searchParams.get("q") ?? "",
      page: page ?? undefined,
      selectedId: url.searchParams.get("selected") ?? undefined,
      companyId: url.searchParams.get("empresa") ?? undefined,
    });
    return json({
      data: result.items,
      selected: result.selected,
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  }

  if (path === "acessos") {
    if (page !== null) {
      const result = await listMembersPage(db, actor, page);
      return json({
        data: result.items,
        meta: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          totalPages: result.totalPages,
        },
      });
    }
    return json({ data: await listMembers(db, actor) });
  }

  return null;
}

export async function postPlatformCompany(
  db: DatabaseExecutor,
  actor: Actor,
  path: string,
  body: unknown,
) {
  if (path === "empresas") return json({ data: await saveCompany(db, actor, body) });

  if (path === "acessos") return json({ data: await saveMember(db, actor, body) });

  if (path === "revogar-acesso") {
    const input = parse(
      z.object({ company_id: z.string().uuid(), user_id: z.string().min(1).max(128) }).strict(),
      body,
    );
    return json({ data: await removeMember(db, actor, input.company_id, input.user_id) });
  }

  return null;
}
