import type { DatabaseExecutor } from "../db/index.ts";
import { countMembers } from "./company-membership-service.ts";
import { companyCounts } from "./company-service.ts";
import { requirePlatformAdmin } from "./platform-access.ts";
import { many, one } from "./platform-store.ts";
import type { Actor } from "./platform-models.ts";

const bookingStatuses = ["pending", "confirmed", "declined", "cancelled"] as const;

export type PlatformBookingStatusSummary = {
  status: (typeof bookingStatuses)[number];
  hotels: number;
  tours: number;
  total: number;
};

export type PlatformDashboardSummary = {
  companyCount: number;
  publishedCount: number;
  memberCount: number;
  pendingCadastur: number;
  contactCount: number;
  bookingRows: PlatformBookingStatusSummary[];
};

export async function platformDashboardSummary(
  db: DatabaseExecutor,
  actor: Actor,
): Promise<PlatformDashboardSummary> {
  requirePlatformAdmin(actor);
  const [companies, memberCount, contactCount, pendingCadastur, bookingGroups] = await Promise.all([
    companyCounts(db, actor),
    countMembers(db, actor),
    one<{ n: number }>(db, "SELECT CAST(COUNT(*) AS INTEGER) n FROM contacts"),
    one<{ n: number }>(
      db,
      "SELECT CAST(COUNT(*) AS INTEGER) n FROM cadastur_entries WHERE review_status='pending'",
    ),
    many<PlatformBookingStatusSummary>(
      db,
      `SELECT status,
              CAST(SUM(CASE WHEN kind='hotel' THEN 1 ELSE 0 END) AS INTEGER) AS hotels,
              CAST(SUM(CASE WHEN kind='tour' THEN 1 ELSE 0 END) AS INTEGER) AS tours,
              CAST(COUNT(*) AS INTEGER) AS total
         FROM bookings
        GROUP BY status`,
    ),
  ]);
  const bookingsByStatus = new Map(bookingGroups.map((row) => [row.status, row]));
  const bookingRows = bookingStatuses.map(
    (status) => bookingsByStatus.get(status) ?? { status, hotels: 0, tours: 0, total: 0 },
  );

  return {
    companyCount: companies.total,
    publishedCount: companies.published,
    memberCount,
    pendingCadastur: Number(pendingCadastur?.n ?? 0),
    contactCount: Number(contactCount?.n ?? 0),
    bookingRows,
  };
}
