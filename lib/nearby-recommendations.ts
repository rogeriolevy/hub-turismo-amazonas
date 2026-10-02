export type HotelLocationReference = {
  key: string;
  name: string;
  city: string;
  address: string;
};

export type NearbyCategory = "restaurant" | "snack" | "bar" | "gym";
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
