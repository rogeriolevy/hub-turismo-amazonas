import { normalizeLabel } from "./cadastur-schema.ts";

export type NearbyGeocodeSource = { name: string; address: string; city: string };
export type NearbyGeocodeCandidate = {
  name?: string;
  display_name?: string;
  address?: Record<string, string | undefined>;
};

export const nearbyGeocoderFeatureNames = [
  "name_similarity",
  "address_similarity",
  "road_similarity",
  "house_number_match",
  "house_number_missing",
  "postcode_match",
] as const;

export type NearbyGeocoderFeature = (typeof nearbyGeocoderFeatureNames)[number];
export type NearbyGeocoderWeights = Record<NearbyGeocoderFeature, number>;

const addressNoise = new Set([
  "avenida",
  "av",
  "bairro",
  "br",
  "centro",
  "conjunto",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "estrada",
  "km",
  "lote",
  "lugar",
  "numero",
  "n",
  "quadra",
  "rua",
  "rodovia",
  "travessa",
]);

function words(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function usefulAddressWords(value: string) {
  return words(value).filter((word) => !addressNoise.has(word) && !/^\d+[a-z]?$/.test(word));
}

function overlap(left: string[], right: string[]) {
  const source = new Set(left);
  const target = new Set(right);
  if (!source.size || !target.size) return 0;
  let shared = 0;
  for (const word of source) if (target.has(word)) shared++;
  return shared / source.size;
}

function exactNumber(value: string) {
  const match = value.match(/\b\d+[a-z]?\b/i);
  return match?.[0].toLowerCase() ?? "";
}

function exactPostcode(value: string) {
  const match = value.match(/\b\d{5}-?\d{3}\b/);
  return match?.[0].replace(/\D/g, "") ?? "";
}

function cityMatch(city: string, candidate: NearbyGeocodeCandidate) {
  const expected = normalizeLabel(city);
  if (!expected) return false;
  const address = candidate.address ?? {};
  const components = [
    address.city,
    address.town,
    address.village,
    address.municipality,
    address.county,
    address.state_district,
    ...(candidate.display_name ?? "").split(","),
  ];
  return components.some((component) => normalizeLabel(component ?? "") === expected);
}

function stateMatch(candidate: NearbyGeocodeCandidate) {
  const address = candidate.address ?? {};
  return [address.state, address["ISO3166-2-lvl4"], address["ISO3166-2-lvl6"]].some((value) => {
    const normalized = normalizeLabel(value ?? "");
    return normalized === "amazonas" || normalized === "am" || normalized === "bram";
  });
}

export function matchesNearbyProviderRegion(
  provider: NearbyGeocodeSource,
  candidate: NearbyGeocodeCandidate,
) {
  if (!cityMatch(provider.city, candidate)) return false;
  const address = candidate.address ?? {};
  const countryCode = normalizeLabel(address.country_code ?? "");
  if (countryCode && countryCode !== "br") return false;
  const state = address.state ?? address["ISO3166-2-lvl4"];
  if (state && !stateMatch(candidate)) return false;
  return true;
}

export function nearbyGeocodeFeatures(
  provider: NearbyGeocodeSource,
  candidate: NearbyGeocodeCandidate,
): NearbyGeocoderWeights {
  const address = candidate.address ?? {};
  const candidateNames = [
    candidate.name,
    address.hotel,
    address.hostel,
    address.guest_house,
    address.tourism,
    address.commercial,
    address.resort,
  ]
    .filter(Boolean)
    .join(" ");
  const candidateRoad = [address.road, address.pedestrian, address.residential, address.highway]
    .filter(Boolean)
    .join(" ");
  const candidateAddress = [
    candidate.display_name,
    candidateRoad,
    address.suburb,
    address.neighbourhood,
    address.quarter,
    address.house_number,
    address.postcode,
  ]
    .filter(Boolean)
    .join(" ");
  const sourceAddressWords = usefulAddressWords(provider.address);
  const candidateAddressWords = usefulAddressWords(candidateAddress);
  const sourceNumber = exactNumber(provider.address);
  const candidateNumber = address.house_number ?? "";
  const sourcePostcode = exactPostcode(provider.address);
  const candidatePostcode = exactPostcode(address.postcode ?? candidateAddress);

  return {
    name_similarity: overlap(words(provider.name), words(candidateNames)),
    address_similarity: overlap(sourceAddressWords, candidateAddressWords),
    road_similarity: overlap(sourceAddressWords, usefulAddressWords(candidateRoad)),
    house_number_match: Number(
      Boolean(sourceNumber && sourceNumber === candidateNumber.toLowerCase()),
    ),
    house_number_missing: Number(Boolean(sourceNumber && !candidateNumber)),
    postcode_match: Number(Boolean(sourcePostcode && sourcePostcode === candidatePostcode)),
  };
}

export function nearbyGeocodeScore(
  provider: NearbyGeocodeSource,
  candidate: NearbyGeocodeCandidate,
  weights: NearbyGeocoderWeights,
  bias: number,
) {
  const features = nearbyGeocodeFeatures(provider, candidate);
  let score = bias;
  for (const feature of nearbyGeocoderFeatureNames) score += features[feature] * weights[feature];
  return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, score))));
}
