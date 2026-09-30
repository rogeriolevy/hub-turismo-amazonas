import { getDatabase } from "@/db";
import { json, errorResponse, HttpError } from "@/server/http";
import {
  publicHotels,
  publicHotel,
  publicTours,
  publicTour,
  publicGuide,
} from "@/server/catalog-service";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const path = (await params).path,
      db = getDatabase(),
      search = new URL(request.url).searchParams.get("q") || "";
    let data: unknown;
    if (path.length === 1 && path[0] === "hospedagens") data = publicHotels(db, search);
    else if (path.length === 1 && path[0] === "passeios") data = publicTours(db, search);
    else if (path.length === 2 && path[0] === "hospedagens") data = publicHotel(db, path[1]);
    else if (path.length === 2 && path[0] === "passeios") data = publicTour(db, path[1]);
    else if (path.length === 2 && path[0] === "guias") data = publicGuide(db, path[1]);
    if (!data) throw new HttpError(404, "NOT_FOUND", "Não encontrado.");
    return json({ data });
  } catch (error) {
    return errorResponse(error, crypto.randomUUID());
  }
}
