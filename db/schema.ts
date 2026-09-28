import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
export const contacts = sqliteTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    fingerprint: text("fingerprint").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    organization: text("organization").notNull().default(""),
    interest: text("interest").notNull(),
    message: text("message").notNull(),
    consentAt: text("consent_at").notNull(),
    privacyVersion: text("privacy_version").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_contacts_idempotency").on(table.idempotencyKey),
    index("idx_contacts_created").on(table.createdAt),
  ],
);
export const rateLimits = sqliteTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    window: integer("window").notNull(),
    attempts: integer("attempts").notNull(),
  },
  (table) => [index("idx_rate_limits_window").on(table.window)],
);
