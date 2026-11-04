import type { DatabaseExecutor } from "../db/index.ts";
import { json } from "./http.ts";
import type { Actor } from "./platform-models.ts";
import { companyInventory, companyInventoryPage } from "./inventory-read-service.ts";
import {
  saveDeparture,
  saveGuide,
  saveRoom,
  saveTour,
  setRoomOperationalStatus,
} from "./inventory-write-service.ts";

export async function getPlatformInventory(
  db: DatabaseExecutor,
  actor: Actor,
  path: string,
  url: URL,
) {
  if (path !== "inventario") return null;

  const companyId = url.searchParams.get("empresa") || "";
  const pageKeys = ["quartosPage", "guiasPage", "passeiosPage", "saidasPage"];
  if (pageKeys.some((key) => url.searchParams.has(key)))
    return json(
      await companyInventoryPage(db, actor, companyId, {
        rooms: url.searchParams.get("quartosPage") ?? undefined,
        guides: url.searchParams.get("guiasPage") ?? undefined,
        tours: url.searchParams.get("passeiosPage") ?? undefined,
        departures: url.searchParams.get("saidasPage") ?? undefined,
      }),
    );

  return json({ data: await companyInventory(db, actor, companyId) });
}

export async function postPlatformInventory(
  db: DatabaseExecutor,
  actor: Actor,
  path: string,
  body: unknown,
) {
  const handlers = {
    quartos: saveRoom,
    "quarto-status": setRoomOperationalStatus,
    guias: saveGuide,
    passeios: saveTour,
    saidas: saveDeparture,
  };

  if (!Object.hasOwn(handlers, path)) return null;

  const action = handlers[path as keyof typeof handlers];
  return json({ data: await action(db, actor, body) });
}
