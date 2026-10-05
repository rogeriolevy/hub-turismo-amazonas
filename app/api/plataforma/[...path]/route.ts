import { z } from "zod";
import { getDatabase } from "@/db";
import { requireActor } from "@/server/platform-session";
import { json, readJson, errorResponse, HttpError } from "@/server/http";
import { parse } from "@/server/platform-store";
import { companiesFor } from "@/server/platform-access";
import { catalogItemDeleteSchema } from "@/lib/platform-schema";
import { deleteCatalogItem, saveCatalogItem } from "@/server/catalog-content-service";
import {
  saveCompany,
  saveMember,
  removeMember,
  saveRoom,
  setRoomOperationalStatus,
  saveGuide,
  saveTour,
  saveDeparture,
  companyInventory,
  listMembers,
} from "@/server/company-service";
import {
  requestBooking,
  myBookings,
  businessBookings,
  decideBooking,
  cancelBooking,
  recordStay,
} from "@/server/booking-service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const actor = await requireActor(request),
      db = getDatabase(),
      path = (await params).path.join("/");
    if (request.method === "GET") {
      const companyId = new URL(request.url).searchParams.get("empresa") || "";
      if (path === "empresas") return json({ data: await companiesFor(db, actor) });
      if (path === "acessos") return json({ data: await listMembers(db, actor) });
      if (path === "inventario")
        return json({ data: await companyInventory(db, actor, companyId) });
      if (path === "minhas-reservas") return json({ data: await myBookings(db, actor) });
      if (path === "reservas") return json({ data: await businessBookings(db, actor, companyId) });
    } else if (request.method === "POST") {
      const body = await readJson(request);
      if (path === "conteudos") return json({ data: await saveCatalogItem(db, actor, body) });
      if (path === "excluir-conteudo") {
        const input = parse(catalogItemDeleteSchema, body);
        return json({ data: await deleteCatalogItem(db, actor, input.id) });
      }
      const handlers = {
        empresas: saveCompany,
        acessos: saveMember,
        quartos: saveRoom,
        "quarto-status": setRoomOperationalStatus,
        guias: saveGuide,
        passeios: saveTour,
        saidas: saveDeparture,
        decisao: decideBooking,
        estadia: recordStay,
      };
      if (Object.hasOwn(handlers, path)) {
        const action = handlers[path as keyof typeof handlers];
        return json({ data: await action(db, actor, body) });
      }
      if (path === "reservas")
        return json(
          {
            data: await requestBooking(
              db,
              actor,
              body,
              request.headers.get("Idempotency-Key") || "",
            ),
          },
          201,
        );
      if (path === "cancelar") {
        const input = parse(z.object({ booking_id: z.string().uuid() }).strict(), body);
        return json({ data: await cancelBooking(db, actor, input.booking_id) });
      }
      if (path === "revogar-acesso") {
        const input = parse(
          z.object({ company_id: z.string().uuid(), user_id: z.string().min(1).max(128) }).strict(),
          body,
        );
        return json({ data: await removeMember(db, actor, input.company_id, input.user_id) });
      }
    }
    throw new HttpError(404, "NOT_FOUND", "Recurso não encontrado.");
  } catch (error) {
    return errorResponse(error, crypto.randomUUID());
  }
}
export const GET = handle;
export const POST = handle;
