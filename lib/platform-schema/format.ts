export function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
export function todayInManaus(now = new Date()) {
  return new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
export function displayDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "America/Manaus",
  }).format(new Date(value.length === 10 ? value + "T12:00:00Z" : value));
}
export function displayTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Manaus",
  }).format(new Date(value));
}
