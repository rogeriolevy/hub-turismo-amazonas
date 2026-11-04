import { createHash } from "node:crypto";
import type { DatabaseExecutor } from "../db/index.ts";
import {
  type HotelLocationReference,
  type NearbyPlace,
  type NearbyRecommendations,
} from "@/lib/nearby-recommendations";
import {
  cacheIsFresh,
  readNearbyCache,
  savedNearbyPlaces,
  writeNearbyLocation,
  writeNearbyPlaces,
} from "./nearby/cache.ts";
import { buildNearbyRecommendations } from "./nearby/recommendation-builder.ts";
import { openStreetMapProvider } from "./nearby/openstreetmap.ts";

const radiusMeters = 2000;
const locationCacheMs = 30 * 24 * 60 * 60 * 1000;
const missingLocationCacheMs = 7 * 24 * 60 * 60 * 1000;
const placesCacheMs = 14 * 24 * 60 * 60 * 1000;

function result(
  status: NearbyRecommendations["status"],
  places: NearbyPlace[] = [],
  updatedAt: string | null = null,
  stale = false,
  hotelLocation: NearbyRecommendations["hotelLocation"] = null,
): NearbyRecommendations {
  return { status, places, radiusMeters, updatedAt, stale, hotelLocation };
}

export async function nearbyRecommendations(
  db: DatabaseExecutor,
  provider: HotelLocationReference,
): Promise<NearbyRecommendations> {
  const sourceHash = createHash("sha256")
    .update(
      JSON.stringify({
        strategy: 3,
        sourceProvider: openStreetMapProvider.id,
        sourceProviderVersion: openStreetMapProvider.cacheVersion,
        hotel: [provider.name, provider.address, provider.city],
      }),
    )
    .digest("hex");
  const now = Date.now();
  let cached = await readNearbyCache(db, provider.key);
  if (cached?.source_hash !== sourceHash) cached = undefined;
  let rawPlaces = savedNearbyPlaces(cached);

  if (
    cached &&
    cached.latitude !== null &&
    cached.longitude !== null &&
    cacheIsFresh(cached.places_updated_at, placesCacheMs, now)
  ) {
    return result(
      "ready",
      await buildNearbyRecommendations(db, provider, rawPlaces, cached.latitude, cached.longitude),
      cached.places_updated_at,
      false,
      { latitude: cached.latitude, longitude: cached.longitude },
    );
  }

  let latitude = cached?.latitude ?? null;
  let longitude = cached?.longitude ?? null;
  const hasFreshLocation = cacheIsFresh(
    cached?.geocoded_at ?? null,
    latitude === null || longitude === null ? missingLocationCacheMs : locationCacheMs,
    now,
  );
  if (!hasFreshLocation) {
    try {
      const location = await openStreetMapProvider.geocode(db, provider);
      if (location) {
        latitude = location.latitude;
        longitude = location.longitude;
      } else if (cached?.latitude === null || cached?.longitude === null || !cached) {
        latitude = null;
        longitude = null;
      }
      await writeNearbyLocation(db, provider, sourceHash, latitude, longitude);
      cached = await readNearbyCache(db, provider.key);
      rawPlaces = savedNearbyPlaces(cached);
    } catch {
      if (latitude === null || longitude === null) {
        return result("temporarily_unavailable", [], cached?.places_updated_at ?? null);
      }
    }
  }

  if (latitude === null || longitude === null)
    return result("location_missing", [], cached?.geocoded_at ?? null);

  try {
    rawPlaces = await openStreetMapProvider.search(db, { latitude, longitude }, radiusMeters);
    await writeNearbyPlaces(db, provider, sourceHash, latitude, longitude, rawPlaces);
    cached = await readNearbyCache(db, provider.key);
    return result(
      "ready",
      await buildNearbyRecommendations(db, provider, rawPlaces, latitude, longitude),
      cached?.places_updated_at ?? new Date().toISOString(),
      false,
      { latitude, longitude },
    );
  } catch {
    if (rawPlaces.length) {
      return result(
        "ready",
        await buildNearbyRecommendations(db, provider, rawPlaces, latitude, longitude),
        cached?.places_updated_at ?? null,
        true,
        { latitude, longitude },
      );
    }
    return result("temporarily_unavailable", [], cached?.places_updated_at ?? null, false, {
      latitude,
      longitude,
    });
  }
}
