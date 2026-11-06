"use client";

import { useLanguage } from "@/components/site/language-provider";
import { LocalizedClientTree } from "@/components/site/localized-client-tree";
import { ArrowRight, ArrowUpRight, Clock, Compass, Info, Plane, Ship } from "lucide-react";
import { navigationSources, type NavigationRoute } from "@/lib/navigation-data";
import { Price, SourceLink } from "./attribution";

type Props = {
  routes: NavigationRoute[];
  filtered: boolean;
  travelDate: string;
  today: string;
  passengers: string;
  onClearFilters: () => void;
  routeActionHref: (route: NavigationRoute) => string;
};

export function NavigationRouteResults({
  routes,
  filtered,
  travelDate,
  today,
  passengers,
  onClearFilters,
  routeActionHref,
}: Props) {
  const { locale } = useLanguage();
  const travelDateLabel = travelDate
    ? new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : locale, { timeZone: "UTC" }).format(
        new Date(travelDate + "T12:00:00Z"),
      )
    : "";

  return (
    <LocalizedClientTree>
      <>
        <div className="nav-result-bar" id="nav-route-results">
          <p role="status">
            {routes.length} {routes.length === 1 ? "trecho encontrado" : "trechos encontrados"}
          </p>
          {filtered && (
            <button type="button" onClick={onClearFilters}>
              Limpar filtros
            </button>
          )}
          <span>
            {travelDateLabel ? `${travelDateLabel} · ` : ""}
            {passengers} {passengers === "1" ? "passageiro" : "passageiros"}
          </span>
        </div>
        <div className="nav-route-grid">
          {routes.map((route) => {
            const Icon = route.mode === "fluvial" ? Ship : Plane;
            const external = route.action.href.startsWith("https://");
            return (
              <article
                className="nav-route-card"
                key={route.id}
                aria-labelledby={route.id + "-title"}
              >
                <div className="nav-card-top">
                  <span className={`nav-mode-badge ${route.mode}`}>
                    <Icon size={16} aria-hidden="true" />
                    {route.mode === "fluvial" ? "Fluvial" : "Aéreo"}
                  </span>
                  <span className="nav-reference-label">
                    {route.price ? "Tarifa de referência" : "A confirmar"}
                  </span>
                </div>
                <h3 id={route.id + "-title"}>
                  {route.origin} <ArrowRight size={20} aria-label="para" /> {route.destination}
                </h3>
                <p className="nav-operator">{route.operator}</p>
                <p className="nav-route-description">{route.summary}</p>
                <p className="nav-schedule-summary">
                  <Clock size={15} aria-hidden="true" />
                  {route.schedule}
                </p>
                <div className="nav-card-bottom">
                  <Price price={route.price} today={today} />
                  <a
                    className="nav-action"
                    href={routeActionHref(route)}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noopener noreferrer" : undefined}
                  >
                    {route.action.label}
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </a>
                </div>
                <details className="nav-card-sources">
                  <summary>Fonte e condições</summary>
                  {route.price && <p>{route.price.note}</p>}
                  {route.sourceIds.map((id) => (
                    <div key={id}>
                      <SourceLink id={id} />
                      <p>{navigationSources[id].note}</p>
                    </div>
                  ))}
                </details>
              </article>
            );
          })}
        </div>
        {!routes.length && (
          <div className="nav-empty">
            <Compass size={32} aria-hidden="true" />
            <h3>Nenhum trecho com esses filtros.</h3>
            <p>
              A pesquisa ainda não tem informações para essa combinação. Experimente outro destino
              ou tipo de transporte.
            </p>
            <button className="button button-dark" type="button" onClick={onClearFilters}>
              Ver todos os trechos
            </button>
          </div>
        )}
        <p className="nav-inline-note">
          <Info size={17} aria-hidden="true" />
          Valores de referência, sem consulta automática de vagas. Confirme tarifa, datas e
          condições no canal do fornecedor.
        </p>
      </>
    </LocalizedClientTree>
  );
}
