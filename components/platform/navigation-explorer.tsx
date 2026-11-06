"use client";

import { useState, type FormEvent } from "react";
import {
  navigationCities,
  navigationRoutes,
  type ScheduleDirection,
  type TransportMode,
} from "@/lib/navigation-data";
import { filterNavigationRoutes } from "@/lib/navigation";
import { NavigationPackages } from "./navigation/packages";
import { NavigationPracticalGuidance } from "./navigation/practical-guidance";
import { NavigationRouteResults } from "./navigation/route-results";
import { NavigationSearchForm } from "./navigation/search-form";
import { NavigationVesselSchedule } from "./navigation/vessel-schedule";

type NavigationSearch = {
  origem?: string | string[];
  destino?: string | string[];
  modo?: string | string[];
  data?: string | string[];
  pessoas?: string | string[];
};

function queryValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function validTravelDate(value: string, today: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value >= today &&
    !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) &&
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
    ? value
    : "";
}

export function NavigationExplorer({
  today,
  search = {},
}: {
  today: string;
  search?: NavigationSearch;
}) {
  const initialOrigin = navigationCities.find((city) => city === queryValue(search.origem)) ?? "";
  const initialDestination =
    navigationCities.find((city) => city === queryValue(search.destino)) ?? "";
  const initialMode =
    queryValue(search.modo) === "fluvial" || queryValue(search.modo) === "aereo"
      ? (queryValue(search.modo) as TransportMode)
      : "todos";
  const requestedPeople = Number(queryValue(search.pessoas));
  const initialPeople =
    Number.isInteger(requestedPeople) && requestedPeople >= 1 && requestedPeople <= 20
      ? String(requestedPeople)
      : "1";
  const [origin, setOrigin] = useState(initialOrigin);
  const [destination, setDestination] = useState(initialDestination);
  const [mode, setMode] = useState<TransportMode | "todos">(initialMode);
  const [travelDate, setTravelDate] = useState(validTravelDate(queryValue(search.data), today));
  const [passengers, setPassengers] = useState(initialPeople);
  const [direction, setDirection] = useState<ScheduleDirection>("maues-manaus");
  const [day, setDay] = useState("");
  const routes = filterNavigationRoutes(navigationRoutes, { origin, destination, mode });
  const filtered = Boolean(
    origin || destination || mode !== "todos" || travelDate || passengers !== "1",
  );
  function clearFilters() {
    setOrigin("");
    setDestination("");
    setMode("todos");
    setTravelDate("");
    setPassengers("1");
    setDay("");
    setDirection("maues-manaus");
  }
  function searchRoutes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      travelDate &&
      ((origin === "Maués" && destination === "Manaus") ||
        (origin === "Manaus" && destination === "Maués"))
    ) {
      setDirection(origin === "Maués" ? "maues-manaus" : "manaus-maues");
      setDay(String(new Date(`${travelDate}T12:00:00Z`).getUTCDay()));
    }
    document
      .getElementById("nav-route-results")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function routeActionHref(route: (typeof navigationRoutes)[number]) {
    if (!route.action.href.startsWith("https://navegam.com.br/busca")) return route.action.href;
    const url = new URL(route.action.href);
    url.searchParams.set("passageiros", passengers);
    if (travelDate) {
      url.searchParams.set("ida", travelDate);
      url.searchParams.set("type", "ida");
      url.searchParams.delete("volta");
    }
    return url.toString();
  }

  return (
    <>
      <section className="nav-section" id="passagens" aria-labelledby="passagens-title">
        <NavigationSearchForm
          today={today}
          origin={origin}
          destination={destination}
          mode={mode}
          travelDate={travelDate}
          passengers={passengers}
          onOriginChange={setOrigin}
          onDestinationChange={setDestination}
          onModeChange={setMode}
          onTravelDateChange={setTravelDate}
          onPassengersChange={setPassengers}
          onSubmit={searchRoutes}
        />
        <NavigationRouteResults
          routes={routes}
          filtered={filtered}
          travelDate={travelDate}
          today={today}
          passengers={passengers}
          onClearFilters={clearFilters}
          routeActionHref={routeActionHref}
        />
      </section>
      <NavigationVesselSchedule
        direction={direction}
        day={day}
        onDirectionChange={setDirection}
        onDayChange={setDay}
      />
      <NavigationPackages today={today} />
      <NavigationPracticalGuidance />
    </>
  );
}
