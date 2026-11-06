"use client";

import type { FormEvent } from "react";
import { CalendarDays, Compass, MapPin, Plane, Search, Ship, UsersRound } from "lucide-react";
import { navigationCities, type TransportMode } from "@/lib/navigation-data";
import { LocalizedClientTree } from "@/components/site/localized-client-tree";
import { TravelSearchPanel } from "../travel-search";

type NavigationMode = TransportMode | "todos";

type Props = {
  today: string;
  origin: string;
  destination: string;
  mode: NavigationMode;
  travelDate: string;
  passengers: string;
  onOriginChange: (origin: string) => void;
  onDestinationChange: (destination: string) => void;
  onModeChange: (mode: NavigationMode) => void;
  onTravelDateChange: (date: string) => void;
  onPassengersChange: (passengers: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function NavigationSearchForm({
  today,
  origin,
  destination,
  mode,
  travelDate,
  passengers,
  onOriginChange,
  onDestinationChange,
  onModeChange,
  onTravelDateChange,
  onPassengersChange,
  onSubmit,
}: Props) {
  return (
    <LocalizedClientTree>
      <>
        <div className="nav-section-heading">
          <div>
            <p className="eyebrow">PLANEJE SEU TRAJETO</p>
            <h2 id="passagens-title">Por onde vamos?</h2>
          </div>
          <p>Passagens, trechos pesquisados e canais para consultar.</p>
        </div>
        <TravelSearchPanel active="navegacao">
          <div className="nav-search-mode">
            <fieldset className="nav-mode-picker">
              <legend>Tipo de transporte</legend>
              {(
                [
                  { value: "todos", label: "Todos", Icon: Compass },
                  { value: "fluvial", label: "Fluvial", Icon: Ship },
                  { value: "aereo", label: "Aéreo", Icon: Plane },
                ] as const
              ).map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  onClick={() => onModeChange(value)}
                >
                  <Icon size={17} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </fieldset>
          </div>
          <form className="travel-search-form travel-search-form--navigation" onSubmit={onSubmit}>
            <label className="travel-search-field">
              <MapPin size={21} aria-hidden="true" />
              <span>Saindo de</span>
              <select value={origin} onChange={(event) => onOriginChange(event.target.value)}>
                <option value="">Qualquer origem</option>
                {navigationCities.map((city) => (
                  <option key={city}>{city}</option>
                ))}
              </select>
            </label>
            <label className="travel-search-field">
              <MapPin size={21} aria-hidden="true" />
              <span>Indo para</span>
              <select
                value={destination}
                onChange={(event) => onDestinationChange(event.target.value)}
              >
                <option value="">Qualquer destino</option>
                {navigationCities.map((city) => (
                  <option key={city}>{city}</option>
                ))}
              </select>
            </label>
            <label className="travel-search-field">
              <CalendarDays size={21} aria-hidden="true" />
              <span>Data de saída</span>
              <input
                type="date"
                min={today}
                value={travelDate}
                onChange={(event) => onTravelDateChange(event.target.value)}
                aria-label="Data de saída"
              />
            </label>
            <label className="travel-search-field">
              <UsersRound size={21} aria-hidden="true" />
              <span>Passageiros</span>
              <select
                value={passengers}
                onChange={(event) => onPassengersChange(event.target.value)}
              >
                {Array.from({ length: 20 }, (_, index) => index + 1).map((count) => (
                  <option key={count} value={count}>
                    {count} {count === 1 ? "passageiro" : "passageiros"}
                  </option>
                ))}
              </select>
            </label>
            <button className="travel-search-submit" type="submit">
              Buscar <Search size={18} aria-hidden="true" />
            </button>
          </form>
          <p className="travel-search-note">
            A busca filtra os trechos publicados. Quando disponível, data e passageiros seguem para
            a consulta do operador; tarifas e vagas precisam ser confirmadas.
          </p>
        </TravelSearchPanel>
      </>
    </LocalizedClientTree>
  );
}
