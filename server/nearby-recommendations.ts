import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { normalizeLabel } from "@/lib/cadastur-schema";
import type {
  HotelLocationReference,
  NearbyCategory,
  NearbyPlace,
  NearbyRecommendations,
} from "@/lib/nearby-recommendations";
import { publicProviders } from "@/server/cadastur/public-directory";

type CacheRow = {
  provider_key: string;
  source_hash: string;
  latitude: number | null;
  longitude: number | null;
  geocoded_at: string | null;
  places_json: string;
  places_updated_at: string | null;
};

type RawPlace = {
  id: string;
  name: string;
  category: NearbyCategory;
  latitude: number;
  longitude: number;
};

type GeocodeResult = {
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  address?: Record<string, string | undefined>;
};

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

const radiusMeters = 2000;
const locationCacheMs = 30 * 24 * 60 * 60 * 1000;
const missingLocationCacheMs = 7 * 24 * 60 * 60 * 1000;
const placesCacheMs = 14 * 24 * 60 * 60 * 1000;
const restaurantCacheMs = 5 * 60 * 1000;
const registeredRestaurantEntries = new WeakMap<
  object,
  Map<string, { checkedAt: number; entries: { id: string; name: string }[] }>
>();
const cacheInitialized = new WeakSet<object>();

function ensureCache(db: Database.Database) {
  if (cacheInitialized.has(db)) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS nearby_place_cache (
      provider_key TEXT PRIMARY KEY,
      source_hash TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      geocoded_at TEXT,
      places_json TEXT NOT NULL DEFAULT '[]',
      places_updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS osm_request_limits (
      service TEXT PRIMARY KEY,
      next_allowed_at INTEGER NOT NULL,
      request_date TEXT NOT NULL DEFAULT '',
      request_count INTEGER NOT NULL DEFAULT 0
    );
  `);
  cacheInitialized.add(db);
}

function cacheIsFresh(value: string | null, maxAgeMs: number, now = Date.now()) {
  const time = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(time) && now - time < maxAgeMs;
}

function readCache(db: Database.Database, key: string) {
  return db
    .prepare<[string], CacheRow>("SELECT * FROM nearby_place_cache WHERE provider_key=?")
    .get(key);
}

function writeLocation(
  db: Database.Database,
  provider: HotelLocationReference,
  sourceHash: string,
  latitude: number | null,
  longitude: number | null,
) {
  const now = new Date().toISOString();
  db.prepare(
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
  ).run(provider.key, sourceHash, latitude, longitude, now);
}

function writePlaces(
  db: Database.Database,
  provider: HotelLocationReference,
  sourceHash: string,
  latitude: number,
  longitude: number,
  places: RawPlace[],
) {
  const now = new Date().toISOString();
  db.prepare(
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
  ).run(provider.key, sourceHash, latitude, longitude, now, JSON.stringify(places), now);
}

function savedPlaces(row: CacheRow | undefined): RawPlace[] {
  if (!row) return [];
  try {
    const data = JSON.parse(row.places_json) as RawPlace[];
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

function endpointIdentity() {
  const siteUrl = process.env.SITE_URL || "http://127.0.0.1:3005";
  return {
    siteUrl,
    headers: {
      "User-Agent": `HubTurismoAmazonas/0.4 (${siteUrl})`,
      Referer: siteUrl,
    },
  };
}

async function reserveNominatimSlot(db: Database.Database) {
  const scheduledAt = db.transaction(() => {
    const now = Date.now();
    const current = db
      .prepare<[string], { next_allowed_at: number }>(
        "SELECT next_allowed_at FROM osm_request_limits WHERE service=?",
      )
      .get("nominatim");
    const slot = Math.max(now, current?.next_allowed_at ?? now);
    db.prepare(
      "INSERT INTO osm_request_limits (service,next_allowed_at) VALUES (?,?) ON CONFLICT(service) DO UPDATE SET next_allowed_at=excluded.next_allowed_at",
    ).run("nominatim", slot + 1100);
    return slot;
  })();
  const delay = scheduledAt - Date.now();
  if (delay > 8000) throw new Error("Fila de geocodificação ocupada.");
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
}

async function reserveOverpassSlot(db: Database.Database) {
  const scheduledAt = db.transaction(() => {
    const now = Date.now();
    const day = new Date(now).toISOString().slice(0, 10);
    const current = db
      .prepare<[string], { next_allowed_at: number; request_date: string; request_count: number }>(
        "SELECT next_allowed_at,request_date,request_count FROM osm_request_limits WHERE service=?",
      )
      .get("overpass");
    const count = current?.request_date === day ? current.request_count : 0;
    if (count >= 90) throw new Error("Limite diário de consultas ao mapa atingido.");
    const slot = Math.max(now, current?.next_allowed_at ?? now);
    db.prepare(
      `INSERT INTO osm_request_limits (service,next_allowed_at,request_date,request_count)
       VALUES (?,?,?,?)
       ON CONFLICT(service) DO UPDATE SET next_allowed_at=excluded.next_allowed_at,
         request_date=excluded.request_date,request_count=excluded.request_count`,
    ).run("overpass", slot + 1100, day, count + 1);
    return slot;
  })();
  const delay = scheduledAt - Date.now();
  if (delay > 8000) throw new Error("Fila de consultas ao mapa ocupada.");
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
}

function matchesPlace(result: GeocodeResult, provider: HotelLocationReference) {
  const address = result.address ?? {};
  const city = normalizeLabel(provider.city);
  const resolvedCity = normalizeLabel(
    [address.city, address.town, address.village, address.municipality, address.county]
      .filter(Boolean)
      .join(" "),
  );
  const display = normalizeLabel(result.display_name ?? "");
  const cityMatches = Boolean(city && (resolvedCity.includes(city) || display.includes(city)));
  if (!cityMatches) return false;

  const searchedName = normalizeLabel(provider.name);
  const resolvedNames = [
    result.name,
    address.hotel,
    address.hostel,
    address.guest_house,
    address.tourism,
    address.commercial,
  ]
    .filter(Boolean)
    .map((value) => normalizeLabel(value!));
  const nameMatches = resolvedNames.some(
    (name) =>
      name === searchedName ||
      (Math.min(name.length, searchedName.length) >= 8 &&
        (name.includes(searchedName) || searchedName.includes(name))),
  );

  const sourceAddress = normalizeLabel(provider.address);
  const addressParts = [address.road, address.pedestrian, address.residential, address.suburb]
    .filter(Boolean)
    .map((value) => normalizeLabel(value!));
  const addressMatches = addressParts.some(
    (part) => part.length >= 7 && sourceAddress.includes(part),
  );
  return nameMatches || (Boolean(provider.address) && addressMatches);
}

async function geocodeHotel(db: Database.Database, provider: HotelLocationReference) {
  await reserveNominatimSlot(db);
  const baseUrl = (process.env.OSM_NOMINATIM_URL || "https://nominatim.openstreetmap.org").replace(
    /\/$/,
    "",
  );
  const query = [provider.name, provider.address, provider.city, "Amazonas", "Brasil"]
    .filter(Boolean)
    .join(", ");
  const url = new URL(`${baseUrl}/search`);
  url.search = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    countrycodes: "br",
    limit: "5",
    "accept-language": "pt-BR",
  }).toString();
  const response = await fetch(url, {
    headers: endpointIdentity().headers,
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("O serviço de localização está indisponível.");
  const results = (await response.json()) as GeocodeResult[];
  for (const result of results) {
    if (!matchesPlace(result, provider)) continue;
    const latitude = Number(result.lat);
    const longitude = Number(result.lon);
    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180
    )
      return { latitude, longitude };
  }
  return null;
}

function categoryFor(tags: Record<string, string>): NearbyCategory | null {
  const amenity = tags.amenity;
  if (amenity === "restaurant") return "restaurant";
  if (amenity === "fast_food" || amenity === "cafe" || amenity === "food_court") return "snack";
  if (amenity === "bar" || amenity === "pub") return "bar";
  if (tags.leisure === "fitness_centre" || tags.sport === "fitness") return "gym";
  return null;
}

function coordinatesOf(element: OverpassElement) {
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude: latitude!, longitude: longitude! }
    : null;
}

async function nearbyFromOverpass(
  db: Database.Database,
  latitude: number,
  longitude: number,
): Promise<RawPlace[]> {
  await reserveOverpassSlot(db);
  const endpoint = process.env.OSM_OVERPASS_URL || "https://overpass-api.de/api/interpreter";
  const query = `[out:json][timeout:12];(
    nwr(around:${radiusMeters},${latitude},${longitude})[amenity~"^(restaurant|fast_food|cafe|food_court|bar|pub)$"];
    nwr(around:${radiusMeters},${latitude},${longitude})[leisure=fitness_centre];
    nwr(around:${radiusMeters},${latitude},${longitude})[sport=fitness];
  );out center tags;`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      ...endpointIdentity().headers,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("O mapa colaborativo está indisponível.");
  const payload = (await response.json()) as { elements?: OverpassElement[] };
  const elements = Array.isArray(payload.elements) ? payload.elements : [];
  const seen = new Set<string>();
  const results: RawPlace[] = [];
  for (const element of elements) {
    const tags = element.tags ?? {};
    const name = tags.name?.trim().slice(0, 120);
    const category = categoryFor(tags);
    const coordinates = coordinatesOf(element);
    if (!name || !category || !coordinates) continue;
    const deduplicationKey = `${category}:${normalizeLabel(name)}:${Math.round(coordinates.latitude * 1000)}:${Math.round(coordinates.longitude * 1000)}`;
    if (seen.has(deduplicationKey)) continue;
    seen.add(deduplicationKey);
    results.push({
      id: `${element.type}/${element.id}`,
      name,
      category,
      ...coordinates,
    });
  }
  return results;
}

function distanceBetweenMeters(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number,
) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLatitude = radians(toLatitude - fromLatitude);
  const deltaLongitude = radians(toLongitude - fromLongitude);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(radians(fromLatitude)) *
      Math.cos(radians(toLatitude)) *
      Math.sin(deltaLongitude / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function restaurantCatalogFor(db: Database.Database, city: string) {
  const key = normalizeLabel(city);
  const byCity = registeredRestaurantEntries.get(db);
  const cached = byCity?.get(key);
  if (cached && Date.now() - cached.checkedAt < restaurantCacheMs) return cached.entries;
  const entries = publicProviders(db, "gastronomia")
    .filter((entry) => normalizeLabel(entry.city) === key)
    .map((entry) => ({ id: entry.id, name: normalizeLabel(entry.name) }));
  const next =
    byCity ?? new Map<string, { checkedAt: number; entries: { id: string; name: string }[] }>();
  next.set(key, { checkedAt: Date.now(), entries });
  registeredRestaurantEntries.set(db, next);
  return entries;
}

function registeredHubEntry(
  name: string,
  category: NearbyCategory,
  catalog: { id: string; name: string }[],
) {
  if (category === "gym") return undefined;
  const normalizedName = normalizeLabel(name);
  return catalog.find(
    (entry) =>
      entry.name === normalizedName ||
      (Math.min(entry.name.length, normalizedName.length) >= 7 &&
        (entry.name.includes(normalizedName) || normalizedName.includes(entry.name))),
  );
}

function googleMapsSearchUrl(query: string) {
  const params = new URLSearchParams({ api: "1", query });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

function recommendationsFrom(
  db: Database.Database,
  provider: HotelLocationReference,
  rawPlaces: RawPlace[],
  latitude: number,
  longitude: number,
): NearbyPlace[] {
  const catalog = restaurantCatalogFor(db, provider.city);
  const categoryGroup: Record<NearbyCategory, number> = {
    restaurant: 0,
    snack: 0,
    bar: 1,
    gym: 2,
  };
  const categoryOrder: Record<NearbyCategory, number> = {
    restaurant: 0,
    snack: 1,
    bar: 2,
    gym: 3,
  };
  return rawPlaces
    .map((place) => {
      const hubEntry = registeredHubEntry(place.name, place.category, catalog);
      const distanceMeters = distanceBetweenMeters(
        latitude,
        longitude,
        place.latitude,
        place.longitude,
      );
      return {
        id: place.id,
        name: place.name,
        category: place.category,
        distanceMeters,
        registeredInHub: Boolean(hubEntry),
        registeredProviderId: hubEntry?.id,
        googleMapsUrl: googleMapsSearchUrl(`${place.name} ${place.latitude},${place.longitude}`),
      };
    })
    .sort(
      (a, b) =>
        categoryGroup[a.category] - categoryGroup[b.category] ||
        Number(b.registeredInHub) - Number(a.registeredInHub) ||
        categoryOrder[a.category] - categoryOrder[b.category] ||
        a.distanceMeters - b.distanceMeters,
    )
    .filter((place, index, all) => {
      const categoryIndex = all
        .slice(0, index)
        .filter((candidate) => candidate.category === place.category).length;
      const cap = place.category === "restaurant" || place.category === "snack" ? 6 : 4;
      return categoryIndex < cap;
    });
}

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
  db: Database.Database,
  provider: HotelLocationReference,
): Promise<NearbyRecommendations> {
  ensureCache(db);
  const sourceHash = createHash("sha256")
    .update([provider.name, provider.address, provider.city].join("\n"))
    .digest("hex");
  const now = Date.now();
  let cached = readCache(db, provider.key);
  if (cached?.source_hash !== sourceHash) cached = undefined;
  let rawPlaces = savedPlaces(cached);

  if (
    cached &&
    cached.latitude !== null &&
    cached.longitude !== null &&
    cacheIsFresh(cached.places_updated_at, placesCacheMs, now)
  ) {
    return result(
      "ready",
      recommendationsFrom(db, provider, rawPlaces, cached.latitude, cached.longitude),
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
      const location = await geocodeHotel(db, provider);
      if (location) {
        latitude = location.latitude;
        longitude = location.longitude;
      } else if (cached?.latitude === null || cached?.longitude === null || !cached) {
        latitude = null;
        longitude = null;
      }
      writeLocation(db, provider, sourceHash, latitude, longitude);
      cached = readCache(db, provider.key);
      rawPlaces = savedPlaces(cached);
    } catch {
      if (latitude === null || longitude === null) {
        return result("temporarily_unavailable", [], cached?.places_updated_at ?? null);
      }
    }
  }

  if (latitude === null || longitude === null)
    return result("location_missing", [], cached?.geocoded_at ?? null);

  try {
    rawPlaces = await nearbyFromOverpass(db, latitude, longitude);
    writePlaces(db, provider, sourceHash, latitude, longitude, rawPlaces);
    cached = readCache(db, provider.key);
    return result(
      "ready",
      recommendationsFrom(db, provider, rawPlaces, latitude, longitude),
      cached?.places_updated_at ?? new Date().toISOString(),
      false,
      { latitude, longitude },
    );
  } catch {
    if (rawPlaces.length) {
      return result(
        "ready",
        recommendationsFrom(db, provider, rawPlaces, latitude, longitude),
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
