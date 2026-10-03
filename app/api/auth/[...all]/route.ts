import { getAuth } from "@/server/auth";
import { getClientIp } from "@/server/client-ip";
import { errorResponse, HttpError, readJson } from "@/server/http";
import {
  captchaRequired,
  captchaUnavailableMessage,
  isTurnstileConfigured,
} from "@/server/turnstile";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  try {
    const path = new URL(request.url).pathname;
    const allowed =
      request.method === "POST"
        ? ["/api/auth/sign-in/email", "/api/auth/sign-out"]
        : ["/api/auth/get-session", "/api/auth/token", "/api/auth/jwks"];
    if (!allowed.includes(path)) throw new HttpError(404, "NOT_FOUND", "Recurso não disponível.");
    if (path === "/api/auth/sign-in/email" && captchaRequired() && !isTurnstileConfigured())
      throw new HttpError(503, "CAPTCHA_CONFIGURATION", captchaUnavailableMessage());
    const headers = new Headers(request.headers);
    headers.set("x-hub-client-ip", getClientIp(request.headers));
    const body = request.method === "POST" ? JSON.stringify(await readJson(request)) : undefined;
    headers.delete("content-length");
    const response = await getAuth().handler(
      new Request(request.url, { method: request.method, headers, body }),
    );
    response.headers.set(
      "Cache-Control",
      path === "/api/auth/jwks" ? "public, max-age=3600, must-revalidate" : "private, no-store",
    );
    return response;
  } catch (error) {
    return errorResponse(error, crypto.randomUUID());
  }
}
export const GET = handle;
export const POST = handle;
