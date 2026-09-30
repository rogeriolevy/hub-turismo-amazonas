import type Database from "better-sqlite3";
import { createHash, randomUUID } from "node:crypto";
import { contactSchema, privacyVersion } from "../lib/contact-schema.ts";
import { HttpError } from "./http.ts";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export async function createContact(
  db: Database.Database,
  raw: unknown,
  key: string | null,
  ip: string,
) {
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
  const fingerprint = digest(JSON.stringify(data));
  // Keep the duplicate check, quota and write atomic across database connections.
  return db
    .transaction(() => {
      const existing = db
        .prepare("SELECT id, fingerprint FROM contacts WHERE idempotency_key = ?")
        .get(key) as { id: string; fingerprint: string } | undefined;
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
      db.prepare("DELETE FROM rate_limits WHERE window < ?").run(window - 1);
      for (const [scope, value, limit] of [
        ["email", data.email, 5],
        ["ip", ip, 30],
      ] as const) {
        const allowed = db
          .prepare(
            "INSERT INTO rate_limits (key, window, attempts) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET attempts = attempts + 1 WHERE attempts < ? RETURNING attempts",
          )
          .get(digest(scope + ":" + window + ":" + value), window, limit);
        if (!allowed)
          throw new HttpError(
            429,
            "RATE_LIMIT",
            "Muitos envios em pouco tempo. Tente novamente em uma hora.",
          );
      }
      const id = randomUUID();
      const now = new Date().toISOString();
      db.prepare(
        "INSERT INTO contacts (id, idempotency_key, fingerprint, name, email, organization, interest, message, consent_at, privacy_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).run(
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
      );
      return { id, duplicate: false };
    })
    .immediate();
}
export function listContacts(db: Database.Database, page: number) {
  const pageSize = 20;
  const data = db
    .prepare(
      "SELECT id, name, email, organization, interest, message, created_at FROM contacts ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
    )
    .all(pageSize, (page - 1) * pageSize);
  const { total } = db.prepare("SELECT COUNT(*) AS total FROM contacts").get() as { total: number };
  return { data, page, pageSize, total };
}
