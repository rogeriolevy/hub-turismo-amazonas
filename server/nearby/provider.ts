import type { DatabaseExecutor } from "../../db/index.ts";
import type { HotelLocationReference, NearbyCategory } from "../../lib/nearby-recommendations.ts";

export type NearbyCoordinates = { latitude: number; longitude: number };

export type NearbySourcePlace = {
  id: string;
  name: string;
  category: NearbyCategory;
  latitude: number;
  longitude: number;
};

export interface NearbyPlacesProvider {
  readonly id: string;
  readonly cacheVersion: string;
  geocode(
    db: DatabaseExecutor,
    provider: HotelLocationReference,
  ): Promise<NearbyCoordinates | null>;
  search(
    db: DatabaseExecutor,
    location: NearbyCoordinates,
    radiusMeters: number,
  ): Promise<NearbySourcePlace[]>;
}
