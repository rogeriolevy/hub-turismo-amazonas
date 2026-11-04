import { randomInt } from "node:crypto";
import type { DatabaseExecutor } from "../db/index.ts";
import { profileSchema } from "../lib/platform-schema/account.ts";
import { profileAvatars, profileAvatarUrl } from "../lib/profile-avatars.ts";
import { HttpError } from "./http.ts";
import { one, parse, run } from "./platform-store.ts";

export function parseOwnProfileInput(input: unknown) {
  return parse(profileSchema, input);
}

type OwnProfileInput = ReturnType<typeof parseOwnProfileInput>;

export async function updateOwnProfile(
  db: DatabaseExecutor,
  userId: string,
  data: OwnProfileInput,
) {
  const image = profileAvatarUrl(data.avatar);
  const result = await run(
    db,
    'UPDATE "user" SET name = ?, image = ?, updatedAt = ? WHERE id = ?',
    data.name,
    image,
    new Date().toISOString(),
    userId,
  );
  if (result.changes !== 1)
    throw new HttpError(404, "PROFILE_NOT_FOUND", "Não foi possível localizar seu perfil.");
  return { name: data.name, image };
}

export async function assignInitialProfileAvatar(db: DatabaseExecutor, email: string) {
  const user = await one<{ id: string }>(db, 'SELECT id FROM "user" WHERE email = ?', email);
  if (!user) return;

  const avatar = profileAvatars[randomInt(profileAvatars.length)];
  await run(
    db,
    'UPDATE "user" SET image = ?, updatedAt = ? WHERE id = ? AND image IS NULL',
    profileAvatarUrl(avatar.key),
    new Date().toISOString(),
    user.id,
  );
}
