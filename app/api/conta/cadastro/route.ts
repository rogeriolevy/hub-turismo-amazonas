import { betterAuth } from "better-auth";
import { getDatabase } from "@/db";
import { authOptions } from "@/server/auth-config";
import { isAdmin } from "@/server/authorization";
import { getClientIp } from "@/server/client-ip";
import { readJson, errorResponse, HttpError } from "@/server/http";
import { parse } from "@/server/platform-store";
import { registrationSchema } from "@/lib/platform-schema";
const createRegistrationAuth = () => betterAuth(authOptions(getDatabase(), true));
let registrationAuth: ReturnType<typeof createRegistrationAuth> | undefined;
export async function POST(request: Request) {
  try {
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
        body: JSON.stringify({ name: input.name, email: input.email, password: input.password }),
      }),
    );
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return errorResponse(error, crypto.randomUUID());
  }
}
