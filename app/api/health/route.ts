import { getDatabase } from "@/db";
import { json } from "@/server/http";
import { one } from "@/server/platform-store";
export async function GET() {
  try {
    await one(getDatabase(), "SELECT 1 FROM contacts LIMIT 1");
    return json({ status: "ok" });
  } catch {
    return json({ status: "unavailable" }, 503);
  }
}
