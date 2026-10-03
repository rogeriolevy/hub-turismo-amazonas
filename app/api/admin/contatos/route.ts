import { getDatabase } from "@/db";
import { authorizeAdmin } from "@/server/admin";
import { listContacts } from "@/server/contact-service";
import { json, errorResponse, HttpError } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await authorizeAdmin(request);
    const raw = new URL(request.url).searchParams.get("page") || "1";
    if (!/^[1-9]\d{0,5}$/.test(raw)) throw new HttpError(400, "PAGINATION", "Página inválida.");
    return json(listContacts(getDatabase(), Number(raw)));
  } catch (error) {
    return errorResponse(error, crypto.randomUUID());
  }
}
