import { todayInManaus } from "./platform-schema";

export type StaySearchInput = {
  entrada?: string | string[];
  saida?: string | string[];
  pessoas?: string | string[];
};

export type StaySearchValues = { entrada: string; saida: string; pessoas: string };

function single(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function isCalendarDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) &&
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
  );
}

export function normalizeStaySearch(
  input: StaySearchInput = {},
  today = todayInManaus(),
): StaySearchValues {
  const requestedArrival = single(input.entrada);
  const requestedDeparture = single(input.saida);
  const arrivalIsValid = isCalendarDate(requestedArrival) && requestedArrival >= today;
  const departureIsValid =
    isCalendarDate(requestedDeparture) && requestedDeparture > requestedArrival;
  const nights =
    arrivalIsValid && departureIsValid
      ? (Date.parse(`${requestedDeparture}T12:00:00Z`) -
          Date.parse(`${requestedArrival}T12:00:00Z`)) /
        86400000
      : 0;
  const peopleValue = Number(single(input.pessoas));
  const people = Number.isInteger(peopleValue) && peopleValue >= 1 && peopleValue <= 20;

  return {
    entrada: nights >= 1 && nights <= 30 ? requestedArrival : "",
    saida: nights >= 1 && nights <= 30 ? requestedDeparture : "",
    pessoas: people ? String(peopleValue) : "1",
  };
}

export function staySearchQuery(values: StaySearchValues) {
  const params = new URLSearchParams();
  if (values.entrada && values.saida) {
    params.set("entrada", values.entrada);
    params.set("saida", values.saida);
  }
  params.set("pessoas", values.pessoas);
  return params.toString();
}
