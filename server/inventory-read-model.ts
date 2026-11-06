import type { DatabaseExecutor } from "../db/index.ts";
import { many, one } from "./platform-store.ts";

export const INVENTORY_PAGE_SIZE = 20;

export type InventoryPage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function emptyInventoryPage<T>(): InventoryPage<T> {
  return { items: [], page: 1, pageSize: INVENTORY_PAGE_SIZE, total: 0, totalPages: 1 };
}

export async function inventoryPage<T>(
  db: DatabaseExecutor,
  countSql: string,
  rowsSql: string,
  companyId: string,
  requestedPage?: string | number,
  scopeValues: unknown[] = [],
): Promise<InventoryPage<T>> {
  const parsedPage = Number(requestedPage ?? 1);
  const safePage = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const count = await one<{ total: number | string }>(db, countSql, companyId, ...scopeValues);
  const total = Number(count?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / INVENTORY_PAGE_SIZE));
  const currentPage = Math.min(safePage, totalPages);
  const items = await many<T>(
    db,
    rowsSql,
    companyId,
    ...scopeValues,
    INVENTORY_PAGE_SIZE,
    (currentPage - 1) * INVENTORY_PAGE_SIZE,
  );
  return { items, page: currentPage, pageSize: INVENTORY_PAGE_SIZE, total, totalPages };
}
