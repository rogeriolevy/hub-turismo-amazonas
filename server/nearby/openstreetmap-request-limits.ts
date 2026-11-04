import { lockKey, type DatabaseExecutor } from "../../db/index.ts";
import { one, run, write } from "../platform-store.ts";

type OpenStreetMapService = "nominatim" | "overpass";

export async function reserveOpenStreetMapRequestSlot(
  db: DatabaseExecutor,
  service: OpenStreetMapService,
) {
  const scheduledAt = await write(db, async (tx) => {
    await lockKey(tx, `osm-request-limits:${service}`);
    const now = Date.now();
    const day = new Date(now).toISOString().slice(0, 10);
    const current = await one<{
      next_allowed_at_ms: number | string;
      request_date: string;
      request_count: number;
    }>(
      tx,
      "SELECT next_allowed_at_ms,request_date,request_count FROM osm_request_limits WHERE service=?",
      service,
    );
    const count =
      service === "overpass" && current?.request_date === day ? current.request_count : 0;
    if (service === "overpass" && count >= 90)
      throw new Error("Limite diário de consultas ao mapa atingido.");

    const slot = Math.max(now, Number(current?.next_allowed_at_ms ?? now));
    await run(
      tx,
      `INSERT INTO osm_request_limits (service,next_allowed_at_ms,request_date,request_count)
       VALUES (?,?,?,?)
       ON CONFLICT(service) DO UPDATE SET next_allowed_at_ms=excluded.next_allowed_at_ms,
         request_date=excluded.request_date,request_count=excluded.request_count`,
      service,
      slot + 1100,
      service === "overpass" ? day : "",
      service === "overpass" ? count + 1 : 0,
    );
    return slot;
  });
  const delay = scheduledAt - Date.now();
  if (delay > 8000)
    throw new Error(
      service === "nominatim"
        ? "Fila de geocodificação ocupada."
        : "Fila de consultas ao mapa ocupada.",
    );
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
}
