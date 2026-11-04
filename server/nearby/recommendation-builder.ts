import type { DatabaseExecutor } from "../../db/index.ts";
import { normalizeLabel } from "../../lib/normalize-label.ts";
import {
  googleMapsSearchUrl,
  type HotelLocationReference,
  type NearbyCategory,
  type NearbyPlace,
} from "../../lib/nearby-recommendations.ts";
import { publicProviders } from "../cadastur/public-directory.ts";
import type { NearbySourcePlace } from "./provider.ts";

const restaurantCacheMs = 5 * 60 * 1000;
const registeredRestaurantEntries = new WeakMap<
  object,
  Map<string, { checkedAt: number; entries: { id: string; name: string }[] }>
>();

async function restaurantCatalogFor(db: DatabaseExecutor, city: string) {
  const key = normalizeLabel(city);
  const byCity = registeredRestaurantEntries.get(db);
  const cached = byCity?.get(key);
  if (cached && Date.now() - cached.checkedAt < restaurantCacheMs) return cached.entries;
  const entries = (await publicProviders(db, "gastronomia"))
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

export async function buildNearbyRecommendations(
  db: DatabaseExecutor,
  provider: HotelLocationReference,
  rawPlaces: NearbySourcePlace[],
  latitude: number,
  longitude: number,
): Promise<NearbyPlace[]> {
  const catalog = await restaurantCatalogFor(db, provider.city);
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
