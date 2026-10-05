import { randomInt } from "node:crypto";
import { betterAuth } from "better-auth";
import { getDatabase } from "@/db";
import { authOptions } from "@/server/auth-config";
import { isAdmin } from "@/server/authorization";
import { getClientIp } from "@/server/client-ip";
import { readJson, errorResponse, HttpError } from "@/server/http";
import { one, parse, run } from "@/server/platform-store";
import { registrationSchema } from "@/lib/platform-schema";
import { profileAvatars, profileAvatarUrl } from "@/lib/profile-avatars";
import {
  captchaRequired,
  captchaUnavailableMessage,
  isTurnstileConfigured,
} from "@/server/turnstile";
const createRegistrationAuth = () => betterAuth(authOptions(getDatabase(), true, true));
let registrationAuth: ReturnType<typeof createRegistrationAuth> | undefined;
export async function POST(request: Request) {
  try {
    if (captchaRequired() && !isTurnstileConfigured())
      throw new HttpError(503, "CAPTCHA_CONFIGURATION", captchaUnavailableMessage());
    const input = parse(registrationSchema, await readJson(request));
    if (isAdmin(input.email, process.env.ADMIN_EMAILS))
      throw new HttpError(
        403,
        "RESERVED",
        "Esta conta deve ser configurada pelo responsável pela instalação.",
      );
    registrationAuth ??= createRegistrationAuth();
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    headers.set("x-hub-client-ip", getClientIp(request.headers));
    const response = await registrationAuth.handler(
      new Request(new URL("/api/auth/sign-up/email", request.url), {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: input.name,
          email: input.email,
          password: input.password,
          phoneNumber: input.phoneNumber,
        }),
      }),
    );
    if (response.ok) {
      const db = getDatabase();
      const user = await one<{ id: string }>(
        db,
        'SELECT id FROM "user" WHERE email = ?',
        input.email,
      );
      if (user) {
        const avatar = profileAvatars[randomInt(profileAvatars.length)];
        await run(
          db,
          'UPDATE "user" SET image = ?, updatedAt = ? WHERE id = ? AND image IS NULL',
          profileAvatarUrl(avatar.key),
          new Date().toISOString(),
          user.id,
        );
      }
    }
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return errorResponse(error, crypto.randomUUID());
  }
}
