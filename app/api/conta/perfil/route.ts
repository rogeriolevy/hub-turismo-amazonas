import { profileSchema } from "@/lib/platform-schema";
import { profileAvatarUrl } from "@/lib/profile-avatars";
import { getDatabase } from "@/db";
import { requireActor } from "@/server/platform-session";
import { errorResponse, HttpError, json, readJson } from "@/server/http";
import { parse, run } from "@/server/platform-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    const input = parse(profileSchema, await readJson(request));
    const image = profileAvatarUrl(input.avatar);
    const result = await run(
      getDatabase(),
      'UPDATE "user" SET name = ?, image = ?, updatedAt = ? WHERE id = ?',
      input.name,
      image,
      new Date().toISOString(),
      actor.id,
    );
    if (result.changes !== 1)
      throw new HttpError(404, "PROFILE_NOT_FOUND", "Não foi possível localizar seu perfil.");
    return json({ data: { name: input.name, image } }, 200, {
      "Cache-Control": "private, no-store",
    });
  } catch (error) {
    return errorResponse(error, crypto.randomUUID());
  }
}
