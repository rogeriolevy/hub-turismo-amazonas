import { getDatabase } from "@/db";
import { authorizeAdmin } from "@/server/admin";
import { json, errorResponse, HttpError } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await authorizeAdmin();
    const raw = new URL(request.url).searchParams.get("page") || "1";
    if (!/^[1-9]\d{0,5}$/.test(raw)) throw new HttpError(400, "PAGINATION", "Página inválida.");
    const page = Number(raw);
    const pageSize = 20;
    const db = getDatabase();
    const rows = await db
      .prepare(
        "SELECT id, name, email, organization, interest, message, created_at FROM contacts ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
      )
      .bind(pageSize, (page - 1) * pageSize)
      .all();
    const count = await db
      .prepare("SELECT COUNT(*) AS total FROM contacts")
      .first<{ total: number }>();
    return json({ data: rows.results, page, pageSize, total: count?.total || 0 });
  } catch (error) {
    return errorResponse(error, crypto.randomUUID());
  }
}
