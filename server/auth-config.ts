import type { BetterAuthOptions } from "better-auth";
import { captcha, jwt } from "better-auth/plugins";
import type { DatabaseHandle } from "../db/index.ts";
import { trustedSiteOrigins } from "../lib/trusted-origins.ts";
import { isTurnstileConfigured, turnstileSecretKey } from "./turnstile.ts";

export function authOptions(
  database: DatabaseHandle,
  provision = false,
  protectWithCaptcha = !provision,
  migrationOnly = false,
) {
  const secret =
    process.env.BETTER_AUTH_SECRET ??
    (migrationOnly ? "schema-migration-only-secret-unused" : undefined);
  const baseURL = process.env.SITE_URL ?? (migrationOnly ? "http://localhost:3000" : undefined);
  if (!secret || secret.length < 32)
    throw new Error("Configure BETTER_AUTH_SECRET executando npm run setup.");
  if (!baseURL) throw new Error("Configure SITE_URL.");
  const url = new URL(baseURL);
  if (url.pathname !== "/" || url.search || url.hash)
    throw new Error("SITE_URL deve conter apenas a origem.");
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new Error("HTTPS é obrigatório fora do ambiente local.");
  const plugins = [
    jwt({
      jwt: {
        expirationTime: "15m",
        definePayload: ({ user }) => ({ email: user.email, name: user.name }),
      },
      jwks: { rotationInterval: 60 * 60 * 24 * 30, gracePeriod: 60 * 60 * 24 * 30 },
    }),
    ...(protectWithCaptcha && isTurnstileConfigured()
      ? [
          captcha({
            provider: "cloudflare-turnstile" as const,
            secretKey: turnstileSecretKey(),
            endpoints: ["/sign-in/email", "/sign-up/email"],
          }),
        ]
      : []),
  ];
  return {
    appName: "Hub Turismo Amazonas",
    database,
    secret,
    baseURL: url.origin,
    trustedOrigins: trustedSiteOrigins(url),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !provision,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: false,
    },
    user: {
      additionalFields: {
        phoneNumber: { type: "string", required: false, input: true, unique: true },
      },
    },
    plugins,
    session: { expiresIn: 60 * 60 * 8, updateAge: 60 * 60, cookieCache: { enabled: false } },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 30,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 3600, max: 5 },
      },
    },
    advanced: {
      useSecureCookies: url.protocol === "https:",
      ipAddress: { ipAddressHeaders: ["x-hub-client-ip"] },
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
    },
  } satisfies BetterAuthOptions;
}
