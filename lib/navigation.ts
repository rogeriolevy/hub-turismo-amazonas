import type {
  NavigationRoute,
  ReferencePrice,
  ScheduleDirection,
  TransportMode,
} from "./navigation-data.ts";
import { vesselSchedules } from "./navigation-data.ts";

export function filterNavigationRoutes(
  routes: NavigationRoute[],
  filters: { origin: string; destination: string; mode: TransportMode | "todos" },
) {
  return routes.filter(
    (route) =>
      (!filters.origin || route.origin === filters.origin) &&
      (!filters.destination || route.destination === filters.destination) &&
      (filters.mode === "todos" || route.mode === filters.mode),
  );
}

export function filterVesselSchedules(direction: ScheduleDirection, day: string) {
  return vesselSchedules.filter(
    (row) => row.direction === direction && (day === "" || String(row.day) === day),
  );
}

export function isHistoricalPrice(price: ReferencePrice, today: string) {
  const age = Date.parse(today + "T12:00:00Z") - Date.parse(price.observedAt + "T12:00:00Z");
  return Boolean((price.travelDate && price.travelDate < today) || age > 30 * 86400000);
}

export function navigationDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(date + "T12:00:00Z"),
  );
}

export function navigationMoney(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function navigationPhone(phone: string) {
  return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`;
}
