import type Database from "better-sqlite3";
import type { BetterAuthOptions } from "better-auth";

export function authOptions(database: Database.Database, provision = false) {
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.SITE_URL;
  if (!secret || secret.length < 32)
    throw new Error("Configure BETTER_AUTH_SECRET executando npm run setup.");
  if (!baseURL) throw new Error("Configure SITE_URL.");
  const url = new URL(baseURL);
  if (url.pathname !== "/" || url.search || url.hash)
    throw new Error("SITE_URL deve conter apenas a origem.");
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new Error("HTTPS é obrigatório fora do ambiente local.");
  return {
    appName: "Hub Turismo Amazonas",
    database,
    secret,
    baseURL: url.origin,
    trustedOrigins: [url.origin],
    emailAndPassword: {
      enabled: true,
      disableSignUp: !provision,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: false,
    },
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
