export const normalizeLabel = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export function normalizeSearchTerms(value: string) {
  return [...new Set(value.split(/\s+/).map(normalizeLabel).filter(Boolean))];
}
