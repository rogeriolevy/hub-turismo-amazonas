export const PUBLIC_HOTEL_PAGE_SIZE = 6;
export const PUBLIC_CATALOG_API_PAGE_SIZE = 24;

export function firstSearchValue(item: string | string[] | undefined) {
  return (Array.isArray(item) ? item[0] : item)?.trim().slice(0, 100) ?? "";
}

export function boundedPage(requestedPage: string, pages: number) {
  return Math.max(1, Math.min(pages, /^\d{1,6}$/.test(requestedPage) ? Number(requestedPage) : 1));
}
