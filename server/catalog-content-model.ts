import type { CatalogItem } from "../lib/catalog-content.ts";

export type CatalogItemRow = Omit<CatalogItem, "image_urls"> & { image_urls_json: string };

export function imageList(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string")
      ? (parsed as string[])
      : [];
  } catch {
    return [];
  }
}

export function fromRow(row: CatalogItemRow): CatalogItem {
  const { image_urls_json, ...item } = row;
  return { ...item, image_urls: imageList(image_urls_json) };
}
