import { getDatabase, isPostgresDatabase } from "@/db";
import { json } from "@/server/http";
import { one } from "@/server/platform-store";

const appVersion = process.env.APP_VERSION || process.env.npm_package_version || "development";

export async function GET() {
  let database: "postgresql" | "sqlite" | "unknown" = "unknown";
  try {
    const handle = getDatabase();
    database = isPostgresDatabase(handle) ? "postgresql" : "sqlite";
    if (process.env.CATALOG_MEDIA_STORAGE === "postgres" && database !== "postgresql")
      throw new Error("O armazenamento da VPS exige PostgreSQL.");
    await one(handle, "SELECT 1 FROM contacts LIMIT 1");
    return json({ status: "ok", version: appVersion, database });
  } catch {
    return json({ status: "unavailable", version: appVersion, database }, 503);
  }
}
