export type HotelLocationReference = {
  key: string;
  name: string;
  city: string;
  address: string;
};

export type NearbyCategory = "restaurant" | "snack" | "bar" | "gym";
export type NearbySearch = {
  category: NearbyCategory;
  googleMapsUrl: string;
};

export type NearbyMapsLinks = {
  mapsProvider: "google_maps";
  reference: string;
  hotelMapsUrl: string;
  searches: NearbySearch[];
};

export type NearbyPlace = {
  id: string;
  name: string;
  category: NearbyCategory;
  distanceMeters: number;
  registeredInHub: boolean;
  registeredProviderId?: string;
  googleMapsUrl: string;
};

export type NearbyRecommendations = {
  status: "ready" | "location_missing" | "temporarily_unavailable";
  places: NearbyPlace[];
  radiusMeters: number;
  updatedAt: string | null;
  stale: boolean;
  hotelLocation: { latitude: number; longitude: number } | null;
};

export type NearbyRecommendationResponse = NearbyRecommendations &
  NearbyMapsLinks & { provider: "openstreetmap" };

const searchQueries: { category: NearbyCategory; query: string }[] = [
  { category: "restaurant", query: "restaurantes" },
  { category: "snack", query: "lanchonetes e cafés" },
  { category: "bar", query: "bares" },
  { category: "gym", query: "academias" },
];

export function googleMapsSearchUrl(query: string) {
  const params = new URLSearchParams({ api: "1", query });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

export function nearbyMapsLinks(
  provider: HotelLocationReference,
  location: { latitude: number; longitude: number } | null = null,
): NearbyMapsLinks {
  const reference = [provider.name, provider.address, provider.city, "Amazonas", "Brasil"]
    .map((value) => value.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .join(", ");
  const searchReference = location ? `${location.latitude},${location.longitude}` : reference;
  const hotelSearch = location
    ? [provider.name, provider.address, provider.city, searchReference]
        .map((value) => value.trim())
        .filter(Boolean)
        .join(", ")
    : reference;

  return {
    mapsProvider: "google_maps",
    reference,
    hotelMapsUrl: googleMapsSearchUrl(hotelSearch),
    searches: searchQueries.map(({ category, query }) => ({
      category,
      googleMapsUrl: googleMapsSearchUrl(`${query} perto de ${searchReference}`),
    })),
  };
}
