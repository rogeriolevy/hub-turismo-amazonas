"use client";

import Link from "next/link";
import { ArrowUpRight, Coffee, Dumbbell, MapPin, MapPinned, Utensils, Wine } from "lucide-react";
import type { NearbyCategory } from "@/lib/nearby-recommendations";
import type { MessageKey } from "@/lib/i18n/messages";
import { useLanguage } from "@/components/site/language-provider";
import { useNearbyRecommendations } from "./nearby/use-nearby-recommendations";
import "./nearby-recommendations.css";

type Props = { providerId: string; source: "company" | "cadastur" };

const categories: Record<NearbyCategory, { label: MessageKey; icon: typeof Utensils }> = {
  restaurant: { label: "nearby.restaurant", icon: Utensils },
  snack: { label: "nearby.snack", icon: Coffee },
  bar: { label: "nearby.bar", icon: Wine },
  gym: { label: "nearby.gym", icon: Dumbbell },
};

const googleSearchCategories: { category: NearbyCategory; label: MessageKey }[] = [
  { category: "restaurant", label: "nearby.restaurants" },
  { category: "snack", label: "nearby.snacks" },
  { category: "bar", label: "nearby.bars" },
  { category: "gym", label: "nearby.gyms" },
];

function distanceLabel(meters: number, locale: "pt" | "en" | "es") {
  return meters < 1000
    ? `${meters} m`
    : `${new Intl.NumberFormat(locale === "pt" ? "pt-BR" : locale, { maximumFractionDigits: 1 }).format(meters / 1000)} km`;
}

export function NearbyRecommendations({ providerId, source }: Props) {
  return (
    <NearbyRecommendationsContent
      key={source + ":" + providerId}
      providerId={providerId}
      source={source}
    />
  );
}

function NearbyRecommendationsContent({ providerId, source }: Props) {
  const { locale, t } = useLanguage();
  const { state, retry } = useNearbyRecommendations(providerId, source);

  return (
    <section className="nearby-recommendations" aria-labelledby="nearby-title" aria-live="polite">
      <div className="nearby-heading">
        <span className="nearby-heading-icon">
          <MapPinned size={19} aria-hidden="true" />
        </span>
        <div>
          <p className="nearby-eyebrow">{t("nearby.mapsEyebrow")}</p>
          <h2 id="nearby-title">{t("nearby.title")}</h2>
          <p>{t("nearby.mapsDescription")}</p>
        </div>
      </div>
      {state === "loading" && (
        <div className="nearby-status" role="status">
          <span className="nearby-spinner" aria-hidden="true" />
          {t("nearby.mapsLoading")}
        </div>
      )}
      {state === "error" && (
        <div className="nearby-status nearby-status--error" role="alert">
          <span>{t("nearby.notAvailable")}</span>
          <button type="button" onClick={retry}>
            {t("nearby.retry")}
          </button>
        </div>
      )}
      {typeof state !== "string" && (
        <div className="nearby-google-searches">
          <div className="nearby-google-searches-heading">
            <MapPin size={17} aria-hidden="true" />
            <strong>{t("nearby.searchMaps")}</strong>
          </div>
          <div className="nearby-google-searches-list">
            {googleSearchCategories.map(({ category, label }) => {
              const { icon: Icon } = categories[category];
              const googleMapsUrl = state.searches.find(
                (search) => search.category === category,
              )?.googleMapsUrl;
              if (!googleMapsUrl) return null;
              return (
                <a key={category} href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                  <Icon size={18} aria-hidden="true" />
                  {t(label)}
                  <ArrowUpRight size={15} aria-hidden="true" />
                </a>
              );
            })}
          </div>
          <p>
            {t("nearby.mapsReference")} <span translate="no">{state.reference}</span>{" "}
            <a href={state.hotelMapsUrl} target="_blank" rel="noopener noreferrer">
              {t("nearby.viewHotelMaps")} <ArrowUpRight size={14} aria-hidden="true" />
            </a>
            <br />
            {t("nearby.mapsNote")}
          </p>
        </div>
      )}
      {typeof state !== "string" && state.status === "location_missing" && (
        <p className="nearby-status">{t("nearby.locationMissing")}</p>
      )}
      {typeof state !== "string" && state.status === "temporarily_unavailable" && (
        <div className="nearby-status nearby-status--error" role="status">
          <span>{t("nearby.mapsUnavailable")}</span>
          <button type="button" onClick={retry}>
            {t("nearby.retry")}
          </button>
        </div>
      )}
      {typeof state !== "string" && state.status === "ready" && (
        <>
          {state.places.length ? (
            <div className="nearby-grid">
              {state.places.map((place) => {
                const { icon: Icon, label } = categories[place.category];
                return (
                  <article className="nearby-place" key={place.id}>
                    <span className="nearby-place-icon">
                      <Icon size={19} aria-hidden="true" />
                    </span>
                    <div className="nearby-place-copy">
                      <span className="nearby-place-category">{t(label)}</span>
                      <strong>{place.name}</strong>
                      <span className="nearby-distance">
                        <MapPin size={13} aria-hidden="true" />
                        {t("nearby.distance")} {distanceLabel(place.distanceMeters, locale)}
                      </span>
                    </div>
                    <div className="nearby-place-actions">
                      {place.registeredInHub && (
                        <>
                          <span className="nearby-hub-badge">{t("nearby.hubCatalog")}</span>
                          {place.registeredProviderId && (
                            <Link
                              className="nearby-hub-link"
                              href={`/prestadores/${place.registeredProviderId}`}
                            >
                              {t("nearby.seeInHub")}
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
            <p className="nearby-status">{t("nearby.noPlaces")}</p>
          )}
          <p className="nearby-attribution">
            {t("nearby.attribution")}{" "}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              OpenStreetMap
            </a>
            {state.updatedAt && (
              <>
                {" "}
                · {t(state.stale ? "nearby.checkedAt" : "nearby.updatedAt")}{" "}
                {new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : locale, {
                  timeZone: "America/Manaus",
                }).format(new Date(state.updatedAt))}
              </>
            )}
            . {t("nearby.locationPolicy")}{" "}
            <a
              href="https://operations.osmfoundation.org/policies/nominatim/"
              target="_blank"
              rel="noreferrer"
            >
              {t("nearby.nominatimPolicy")}
            </a>
          </p>
        </>
      )}
    </section>
  );
}
