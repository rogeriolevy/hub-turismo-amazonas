import { createHash } from "node:crypto";
import type { DatabaseExecutor } from "../../db/index.ts";
import { normalizeLabel } from "../../lib/normalize-label.ts";
import type { HotelLocationReference, NearbyCategory } from "../../lib/nearby-recommendations.ts";
import {
  matchesNearbyProviderRegion,
  nearbyGeocodeFeatures,
  nearbyGeocodeScore,
  type NearbyGeocodeCandidate,
} from "../../lib/nearby-geocoder.ts";
import { reserveOpenStreetMapRequestSlot } from "./openstreetmap-request-limits.ts";
import type { NearbyPlacesProvider, NearbySourcePlace } from "./provider.ts";
import geocoderModel from "../nearby-geocoder-model.json" with { type: "json" };

type GeocodeResult = NearbyGeocodeCandidate & {
  lat?: string;
  lon?: string;
};

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

function endpointIdentity() {
  const siteUrl = process.env.SITE_URL || "http://127.0.0.1:3005";
  const version = process.env.npm_package_version || "0.6.2";
  return {
    siteUrl,
    headers: {
      "User-Agent": `HubTurismoAmazonas/${version} (${siteUrl})`,
      Referer: siteUrl,
    },
  };
}

export async function geocodeHotel(db: DatabaseExecutor, provider: HotelLocationReference) {
  const baseUrl = (process.env.OSM_NOMINATIM_URL || "https://nominatim.openstreetmap.org").replace(
    /\/$/,
    "",
  );
  const locality = [provider.city, "Amazonas", "Brasil"].filter(Boolean).join(", ");
  const queries = [
    [provider.name, provider.address, locality].filter(Boolean).join(", "),
    [provider.address, locality].filter(Boolean).join(", "),
    [provider.name, locality].filter(Boolean).join(", "),
  ].filter((query, index, all) => query && all.indexOf(query) === index);

  for (const query of queries) {
    await reserveOpenStreetMapRequestSlot(db, "nominatim");
    const url = new URL(`${baseUrl}/search`);
    url.search = new URLSearchParams({
      q: query,
      format: "jsonv2",
      addressdetails: "1",
      countrycodes: "br",
      limit: "10",
      "accept-language": "pt-BR",
    }).toString();
    const response = await fetch(url, {
      headers: endpointIdentity().headers,
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("O serviço de localização está indisponível.");
    const payload = (await response.json()) as unknown;
    const results = Array.isArray(payload) ? (payload as GeocodeResult[]) : [];
    const match = results
      .filter((candidate) => matchesNearbyProviderRegion(provider, candidate))
      .map((candidate) => ({
        candidate,
        features: nearbyGeocodeFeatures(provider, candidate),
        score: nearbyGeocodeScore(provider, candidate, geocoderModel.weights, geocoderModel.bias),
      }))
      .filter(
        ({ features, score }) =>
          features.name_similarity >= 0.85 ||
          (features.address_similarity >= 0.65 && score >= geocoderModel.threshold),
      )
      .sort((a, b) => b.score - a.score)[0]?.candidate;

    if (match) {
      const latitude = Number(match.lat);
      const longitude = Number(match.lon);
      if (
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        Math.abs(latitude) <= 90 &&
        Math.abs(longitude) <= 180
      )
        return { latitude, longitude };
    }
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
  db: DatabaseExecutor,
  latitude: number,
  longitude: number,
  radiusMeters: number,
): Promise<NearbySourcePlace[]> {
  await reserveOpenStreetMapRequestSlot(db, "overpass");
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
  const results: NearbySourcePlace[] = [];
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

export const openStreetMapProvider: NearbyPlacesProvider = {
  id: "openstreetmap",
  cacheVersion: createHash("sha256").update(JSON.stringify(geocoderModel)).digest("hex"),
  geocode: geocodeHotel,
  search: (db, location, radiusMeters) =>
    nearbyFromOverpass(db, location.latitude, location.longitude, radiusMeters),
};
