import { getDatabase } from "@/db";
import { parseOwnProfileInput, updateOwnProfile } from "@/server/account-service";
import { requireActor } from "@/server/platform-session";
import { errorResponse, json, readJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    const input = parseOwnProfileInput(await readJson(request));
    const data = await updateOwnProfile(getDatabase(), actor.id, input);
    return json({ data }, 200, {
      "Cache-Control": "private, no-store",
    });
  } catch (error) {
    return errorResponse(error, crypto.randomUUID());
  }
}
