import { getDatabase } from "@/db";
import { json, errorResponse, HttpError } from "@/server/http";
import {
  publicHotels,
  publicHotel,
  publicTours,
  publicTour,
  publicGuide,
  searchPublicHotels,
  searchPublicTours,
} from "@/server/catalog-service";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const path = (await params).path,
      db = getDatabase(),
      url = new URL(request.url),
      search = url.searchParams.get("q") || "";
    let data: unknown;
    if (path.length === 1 && path[0] === "hospedagens") {
      if (url.searchParams.has("page")) {
        const result = await searchPublicHotels(
          db,
          { q: search, page: url.searchParams.get("page") ?? "1" },
          24,
        );
        return json({
          data: result.hotels,
          meta: {
            page: result.page,
            pageSize: result.pageSize,
            total: result.total,
            totalPages: result.pages,
          },
        });
      }
      data = await publicHotels(db, search);
    } else if (path.length === 1 && path[0] === "passeios") {
      if (url.searchParams.has("page")) {
        const result = await searchPublicTours(db, {
          q: search,
          page: url.searchParams.get("page") ?? "1",
        });
        return json({
          data: result.tours,
          meta: {
            page: result.page,
            pageSize: result.pageSize,
            total: result.total,
            totalPages: result.pages,
          },
        });
      }
      data = await publicTours(db, search);
    } else if (path.length === 2 && path[0] === "hospedagens")
      data = await publicHotel(db, path[1]);
    else if (path.length === 2 && path[0] === "passeios") data = await publicTour(db, path[1]);
    else if (path.length === 2 && path[0] === "guias") data = await publicGuide(db, path[1]);
    if (!data) throw new HttpError(404, "NOT_FOUND", "Não encontrado.");
    return json({ data });
  } catch (error) {
    return errorResponse(error, crypto.randomUUID());
  }
}
