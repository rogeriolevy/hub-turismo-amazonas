import { getDatabase } from "@/db";
import { requireActor } from "@/server/platform-session";
import { readJson, errorResponse, HttpError } from "@/server/http";
import { getPlatformBookings, postPlatformBooking } from "@/server/platform-bookings-api";
import { getPlatformCatalog, postPlatformCatalog } from "@/server/platform-catalog-api";
import { getPlatformCompanies, postPlatformCompany } from "@/server/platform-companies-api";
import { getPlatformInventory, postPlatformInventory } from "@/server/platform-inventory-api";
import {
  getPlatformNotifications,
  postPlatformNotification,
} from "@/server/platform-notifications-api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const actor = await requireActor(request),
      db = getDatabase(),
      path = (await params).path.join("/");
    if (request.method === "GET") {
      const url = new URL(request.url);
      const companyId = url.searchParams.get("empresa") || "";
      const page = url.searchParams.get("page");
      if (path === "notificacoes") {
        return await getPlatformNotifications(db, actor, page);
      }
      const bookingResponse = await getPlatformBookings(db, actor, path, companyId, page);
      if (bookingResponse) return bookingResponse;
      const companyResponse = await getPlatformCompanies(db, actor, path, url);
      if (companyResponse) return companyResponse;
      const catalogResponse = await getPlatformCatalog(db, actor, path, url);
      if (catalogResponse) return catalogResponse;
      const inventoryResponse = await getPlatformInventory(db, actor, path, url);
      if (inventoryResponse) return inventoryResponse;
    } else if (request.method === "POST") {
      const body = await readJson(request);
      const notificationResponse = await postPlatformNotification(db, actor, path, body);
      if (notificationResponse) return notificationResponse;
      const bookingResponse = await postPlatformBooking(
        db,
        actor,
        path,
        body,
        request.headers.get("Idempotency-Key") || "",
      );
      if (bookingResponse) return bookingResponse;
      const companyResponse = await postPlatformCompany(db, actor, path, body);
      if (companyResponse) return companyResponse;
      const catalogResponse = await postPlatformCatalog(db, actor, path, body);
      if (catalogResponse) return catalogResponse;
      const inventoryResponse = await postPlatformInventory(db, actor, path, body);
      if (inventoryResponse) return inventoryResponse;
    }
    throw new HttpError(404, "NOT_FOUND", "Recurso não encontrado.");
  } catch (error) {
    return errorResponse(error, crypto.randomUUID());
  }
}
export const GET = handle;
export const POST = handle;
