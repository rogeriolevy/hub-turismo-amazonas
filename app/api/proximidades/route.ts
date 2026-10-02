import { getDatabase } from "@/db";
import { normalizeLabel } from "@/lib/cadastur-schema";
import { lodgingHighlights } from "@/lib/lodging-highlights";
import type { HotelLocationReference } from "@/lib/nearby-recommendations";
import { HttpError, errorResponse, json } from "@/server/http";
import { publicProvider } from "@/server/cadastur/public-directory";
import { nearbyRecommendations } from "@/server/nearby-recommendations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id") ?? "";
    const source = url.searchParams.get("origem");
    if (!uuid.test(id) || (source !== "company" && source !== "cadastur"))
      throw new HttpError(400, "INVALID_PROVIDER", "Não foi possível identificar a hospedagem.");

    const db = getDatabase();
    let provider: HotelLocationReference | null = null;
    if (source === "cadastur") {
      const entry = publicProvider(db, id);
      if (entry?.category === "hospedagens") {
        provider = {
          key: `cadastur:${entry.id}`,
          name: entry.name,
          city: entry.city,
          address: entry.address,
        };
      }
    } else {
      provider =
        db
          .prepare<[string], HotelLocationReference>(
            `SELECT
             'company:' || c.id AS key,
             COALESCE(NULLIF(TRIM(c.trade_name),''),c.name) AS name,
             c.city,
             COALESCE((
               SELECT e.address FROM cadastur_entries e
               WHERE e.company_id=c.id AND e.category='hospedagens'
                 AND e.published=1 AND e.review_status='reviewed'
               ORDER BY CASE WHEN TRIM(e.address)<>'' THEN 0 ELSE 1 END,e.imported_at DESC
               LIMIT 1
             ),'') AS address
           FROM companies c
           WHERE c.id=? AND c.kind='hotel' AND c.status='published'`,
          )
          .get(id) ?? null;
      const companyProvider = provider;
      if (companyProvider && !companyProvider.address) {
        const highlight = lodgingHighlights.find(
          (item) =>
            normalizeLabel(item.name) === normalizeLabel(companyProvider.name) &&
            normalizeLabel(item.city) === normalizeLabel(companyProvider.city),
        );
        if (highlight) companyProvider.address = highlight.address;
      }
    }

    if (!provider)
      throw new HttpError(
        404,
        "HOTEL_NOT_FOUND",
        "Esta hospedagem não está disponível no catálogo.",
      );

    const data = await nearbyRecommendations(db, provider);
    return json({ data }, 200, {
      "Cache-Control":
        data.status === "temporarily_unavailable"
          ? "no-store"
          : "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    });
  } catch (error) {
    return errorResponse(error, crypto.randomUUID());
  }
}
