"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Coffee,
  Dumbbell,
  MapPin,
  MapPinned,
  Sparkles,
  Utensils,
  Wine,
} from "lucide-react";
import type {
  NearbyCategory,
  NearbyRecommendations as NearbyData,
} from "@/lib/nearby-recommendations";
import { LocalizedClientTree } from "@/components/site/localized-client-tree";
import { useLanguage } from "@/components/site/language-provider";
import "./nearby-recommendations.css";

type Props = { providerId: string; source: "company" | "cadastur" };
type Result = { retry: number; state: NearbyData | "error" } | null;

const categoryLabels: Record<NearbyCategory, string> = {
  restaurant: "Restaurante",
  snack: "Lanchonete ou cafeteria",
  bar: "Bar",
  gym: "Academia",
};
const categoryIcons = {
  restaurant: Utensils,
  snack: Coffee,
  bar: Wine,
  gym: Dumbbell,
} as const;
const googleSearchCategories: {
  category: NearbyCategory;
  label: string;
  query: string;
}[] = [
  { category: "restaurant", label: "Restaurantes", query: "restaurantes" },
  { category: "snack", label: "Lanchonetes e cafés", query: "lanchonetes e cafés" },
  { category: "bar", label: "Bares", query: "bares" },
  { category: "gym", label: "Academias", query: "academias" },
];

function googleMapsSearchUrl(query: string, latitude: number, longitude: number) {
  const params = new URLSearchParams({
    api: "1",
    query: `${query} near ${latitude},${longitude}`,
  });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

function distanceLabel(meters: number, locale: "pt" | "en" | "es") {
  return meters < 1000
    ? `${meters} m`
    : `${new Intl.NumberFormat(locale === "pt" ? "pt-BR" : locale, { maximumFractionDigits: 1 }).format(meters / 1000)} km`;
}

export function NearbyRecommendations({ providerId, source }: Props) {
  return (
    <NearbyRecommendationsContent
      key={`${source}:${providerId}`}
      providerId={providerId}
      source={source}
    />
  );
}

function NearbyRecommendationsContent({ providerId, source }: Props) {
  const { locale } = useLanguage();
  const [result, setResult] = useState<Result>(null);
  const [retry, setRetry] = useState(0);
  const state = result?.retry === retry ? result.state : "loading";

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45000);
    const query = new URLSearchParams({ id: providerId, origem: source });

    void fetch(`/api/proximidades?${query}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.data) throw new Error("Não foi possível carregar.");
        if (active) setResult({ retry, state: payload.data as NearbyData });
      })
      .catch(() => {
        if (active) setResult({ retry, state: "error" });
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [providerId, retry, source]);

  const hotelLocation = typeof state === "string" ? null : state.hotelLocation;

  return (
    <LocalizedClientTree>
      <section className="nearby-recommendations" aria-labelledby="nearby-title" aria-live="polite">
        <div className="nearby-heading">
          <span className="nearby-heading-icon">
            <Sparkles size={19} aria-hidden="true" />
          </span>
          <div>
            <p className="nearby-eyebrow">SUGESTÕES INTELIGENTES</p>
            <h2 id="nearby-title">O que tem por perto?</h2>
            <p>
              Veja restaurantes, lanchonetes, bares e academias próximos. Quando o local também
              aparece na gastronomia da Hub, ele recebe destaque.
            </p>
          </div>
        </div>

        {state === "loading" && (
          <div className="nearby-status" role="status">
            <span className="nearby-spinner" aria-hidden="true" />
            Procurando lugares mapeados em até {distanceLabel(2000, locale)}…
          </div>
        )}

        {state === "error" && (
          <div className="nearby-status nearby-status--error" role="alert">
            <span>Não foi possível consultar as proximidades agora.</span>
            <button type="button" onClick={() => setRetry((value) => value + 1)}>
              Tentar novamente
            </button>
          </div>
        )}

        {state !== "loading" && state !== "error" && state.status === "location_missing" && (
          <p className="nearby-status">
            Não encontramos um endereço exato para esta hospedagem. As sugestões aparecem quando a
            localização pode ser confirmada.
          </p>
        )}

        {state !== "loading" && state !== "error" && state.status === "temporarily_unavailable" && (
          <div className="nearby-status nearby-status--error" role="status">
            <span>O serviço de mapas está temporariamente indisponível.</span>
            <button type="button" onClick={() => setRetry((value) => value + 1)}>
              Tentar novamente
            </button>
          </div>
        )}

        {hotelLocation && (
          <div className="nearby-google-searches">
            <div className="nearby-google-searches-heading">
              <MapPinned size={17} aria-hidden="true" />
              <strong>Buscar no Google Maps</strong>
            </div>
            <div className="nearby-google-searches-list">
              {googleSearchCategories.map(({ category, label, query }) => {
                const Icon = categoryIcons[category];
                return (
                  <a
                    key={category}
                    href={googleMapsSearchUrl(
                      query,
                      hotelLocation.latitude,
                      hotelLocation.longitude,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon size={15} aria-hidden="true" />
                    {label}
                    <ArrowUpRight size={13} aria-hidden="true" />
                  </a>
                );
              })}
            </div>
            <p>
              A busca usa a localização da hospedagem como referência. O raio aproximado de 2 km é
              aplicado à lista da Hub; os resultados do Google Maps podem variar.
            </p>
          </div>
        )}

        {state !== "loading" && state !== "error" && state.status === "ready" && (
          <>
            {state.places.length ? (
              <div className="nearby-grid">
                {state.places.map((place) => {
                  const Icon = categoryIcons[place.category];
                  return (
                    <article className="nearby-place" key={place.id}>
                      <span className="nearby-place-icon">
                        <Icon size={19} aria-hidden="true" />
                      </span>
                      <div className="nearby-place-copy">
                        <span className="nearby-place-category">
                          {categoryLabels[place.category]}
                        </span>
                        <strong>{place.name}</strong>
                        <span className="nearby-distance">
                          <MapPin size={13} aria-hidden="true" />
                          Cerca de {distanceLabel(place.distanceMeters, locale)}
                        </span>
                      </div>
                      <div className="nearby-place-actions">
                        {place.registeredInHub && (
                          <>
                            <span className="nearby-hub-badge">No catálogo Hub</span>
                            {place.registeredProviderId && (
                              <Link
                                className="nearby-hub-link"
                                href={`/prestadores/${place.registeredProviderId}`}
                              >
                                Ver na Hub
                              </Link>
                            )}
                          </>
                        )}
                        <a href={place.googleMapsUrl} target="_blank" rel="noopener noreferrer">
                          Google Maps <ArrowUpRight size={14} aria-hidden="true" />
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="nearby-status">
                Ainda não há locais mapeados nessa área. A cobertura do mapa pode variar por cidade.
              </p>
            )}
            <p className="nearby-attribution">
              Distâncias aproximadas em linha reta. Dados colaborativos do{" "}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                OpenStreetMap
              </a>
              {state.updatedAt && (
                <>
                  {" "}
                  · {state.stale ? "Dados consultados em" : "Atualizado em"}{" "}
                  {new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : locale, {
                    timeZone: "America/Manaus",
                  }).format(new Date(state.updatedAt))}
                </>
              )}
              . Consulta de localização sujeita à{" "}
              <a
                href="https://operations.osmfoundation.org/policies/nominatim/"
                target="_blank"
                rel="noreferrer"
              >
                política de uso do Nominatim
              </a>
              .
            </p>
          </>
        )}
      </section>
    </LocalizedClientTree>
  );
}
