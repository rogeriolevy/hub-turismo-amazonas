import { getDatabase } from "@/db";
import { json } from "@/server/http";
export async function GET() {
  try {
    await getDatabase().prepare("SELECT 1 FROM contacts LIMIT 1").all();
    return json({ status: "ok" });
  } catch {
    return json({ status: "unavailable" }, 503);
  }
}
