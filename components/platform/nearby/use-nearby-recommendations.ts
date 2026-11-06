import { useEffect, useState } from "react";
import type { NearbyRecommendationResponse } from "@/lib/nearby-recommendations";

type Source = "company" | "cadastur";
type Result = { retry: number; state: NearbyRecommendationResponse | "error" } | null;

export type NearbyRecommendationState = NearbyRecommendationResponse | "loading" | "error";

export function useNearbyRecommendations(providerId: string, source: Source) {
  const [result, setResult] = useState<Result>(null);
  const [retryNumber, setRetryNumber] = useState(0);
  const state: NearbyRecommendationState = result?.retry === retryNumber ? result.state : "loading";

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45000);
    const query = new URLSearchParams({ id: providerId, origem: source });
    void fetch("/api/proximidades?" + query, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (
          !response.ok ||
          payload.data?.provider !== "openstreetmap" ||
          payload.data?.mapsProvider !== "google_maps"
        )
          throw new Error("Nearby unavailable");
        if (active)
          setResult({ retry: retryNumber, state: payload.data as NearbyRecommendationResponse });
      })
      .catch(() => {
        if (active) setResult({ retry: retryNumber, state: "error" });
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [providerId, retryNumber, source]);

  return {
    state,
    retry: () => setRetryNumber((current) => current + 1),
  };
}
