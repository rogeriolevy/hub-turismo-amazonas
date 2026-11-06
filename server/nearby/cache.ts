import type { DatabaseExecutor } from "../../db/index.ts";
import type { HotelLocationReference } from "../../lib/nearby-recommendations.ts";
import { one, run } from "../platform-store.ts";
import type { NearbySourcePlace } from "./provider.ts";

export type NearbyCacheRow = {
  provider_key: string;
  source_hash: string;
  latitude: number | null;
  longitude: number | null;
  geocoded_at: string | null;
  places_json: string;
  places_updated_at: string | null;
};

export function cacheIsFresh(value: string | null, maxAgeMs: number, now = Date.now()) {
  const time = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(time) && now - time < maxAgeMs;
}

export function readNearbyCache(db: DatabaseExecutor, key: string) {
  return one<NearbyCacheRow>(db, "SELECT * FROM nearby_place_cache WHERE provider_key=?", key);
}

export async function writeNearbyLocation(
  db: DatabaseExecutor,
  provider: HotelLocationReference,
  sourceHash: string,
  latitude: number | null,
  longitude: number | null,
) {
  const now = new Date().toISOString();
  await run(
    db,
    `INSERT INTO nearby_place_cache
      (provider_key,source_hash,latitude,longitude,geocoded_at,places_json,places_updated_at)
     VALUES (?,?,?,?,?,'[]',NULL)
     ON CONFLICT(provider_key) DO UPDATE SET
       places_json=CASE WHEN nearby_place_cache.source_hash=excluded.source_hash THEN nearby_place_cache.places_json ELSE '[]' END,
       places_updated_at=CASE WHEN nearby_place_cache.source_hash=excluded.source_hash THEN nearby_place_cache.places_updated_at ELSE NULL END,
       source_hash=excluded.source_hash,
       latitude=excluded.latitude,
       longitude=excluded.longitude,
       geocoded_at=excluded.geocoded_at`,
    provider.key,
    sourceHash,
    latitude,
    longitude,
    now,
  );
}

export async function writeNearbyPlaces(
  db: DatabaseExecutor,
  provider: HotelLocationReference,
  sourceHash: string,
  latitude: number,
  longitude: number,
  places: NearbySourcePlace[],
) {
  const now = new Date().toISOString();
  await run(
    db,
    `INSERT INTO nearby_place_cache
      (provider_key,source_hash,latitude,longitude,geocoded_at,places_json,places_updated_at)
     VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(provider_key) DO UPDATE SET
       source_hash=excluded.source_hash,
       latitude=excluded.latitude,
       longitude=excluded.longitude,
       geocoded_at=excluded.geocoded_at,
       places_json=excluded.places_json,
       places_updated_at=excluded.places_updated_at`,
    provider.key,
    sourceHash,
    latitude,
    longitude,
    now,
    JSON.stringify(places),
    now,
  );
}

export function savedNearbyPlaces(row: NearbyCacheRow | undefined): NearbySourcePlace[] {
  if (!row) return [];
  try {
    const data = JSON.parse(row.places_json) as NearbySourcePlace[];
    return Array.isArray(data)
      ? data.filter(
          (place) =>
            typeof place.name === "string" &&
            Number.isFinite(place.latitude) &&
            Number.isFinite(place.longitude),
        )
      : [];
  } catch {
    return [];
  }
}
