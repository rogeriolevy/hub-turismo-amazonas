import { contactSchema, privacyVersion } from "../lib/contact-schema.ts";
import { HttpError } from "./http.ts";
async function digest(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
export async function createContact(db: D1Database, raw: unknown, key: string | null, ip: string) {
  const result = contactSchema.safeParse(raw);
  if (!result.success)
    throw new HttpError(
      422,
      "VALIDATION",
      "Revise os campos destacados.",
      result.error.flatten().fieldErrors,
    );
  if (!key || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key))
    throw new HttpError(400, "IDEMPOTENCY", "Identificador de envio inválido. Atualize a página.");
  const data = result.data;
  const fingerprint = await digest(JSON.stringify(data));
  const existing = await db
    .prepare("SELECT id, fingerprint FROM contacts WHERE idempotency_key = ?")
    .bind(key)
    .first<{ id: string; fingerprint: string }>();
  if (existing) {
    if (existing.fingerprint !== fingerprint)
      throw new HttpError(
        409,
        "CONFLICT",
        "Este envio já foi concluído com outra mensagem. Inicie um novo contato.",
      );
    return { id: existing.id, duplicate: true };
  }
  const window = Math.floor(Date.now() / 3600000);
  await db
    .prepare("DELETE FROM rate_limits WHERE window < ?")
    .bind(window - 1)
    .run();
  for (const [scope, value, limit] of [
    ["email", data.email, 5],
    ["ip", ip, 30],
  ] as const) {
    const rateKey = await digest(scope + ":" + window + ":" + value);
    const allowed = await db
      .prepare(
        "INSERT INTO rate_limits (key, window, attempts) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET attempts = attempts + 1 WHERE attempts < ? RETURNING attempts",
      )
      .bind(rateKey, window, limit)
      .first();
    if (!allowed)
      throw new HttpError(
        429,
        "RATE_LIMIT",
        "Muitos envios em pouco tempo. Tente novamente em uma hora.",
      );
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db
    .prepare(
      "INSERT INTO contacts (id, idempotency_key, fingerprint, name, email, organization, interest, message, consent_at, privacy_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(idempotency_key) DO NOTHING",
    )
    .bind(
      id,
      key,
      fingerprint,
      data.name,
      data.email,
      data.organization,
      data.interest,
      data.message,
      now,
      privacyVersion,
      now,
    )
    .run();
  const saved = await db
    .prepare("SELECT id, fingerprint FROM contacts WHERE idempotency_key = ?")
    .bind(key)
    .first<{ id: string; fingerprint: string }>();
  if (!saved) throw new Error("Write not confirmed");
  if (saved.fingerprint !== fingerprint)
    throw new HttpError(409, "CONFLICT", "Este identificador já foi utilizado.");
  return { id: saved.id, duplicate: saved.id !== id };
}
