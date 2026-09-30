import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../db/index.ts";
import { migrateContacts } from "../db/migrate.ts";
import { createContact } from "../server/contact-service.ts";
import { contactSchema } from "../lib/contact-schema.ts";
import { readJson, errorResponse, HttpError } from "../server/http.ts";
import { isAdmin } from "../server/authorization.ts";
const valid = {
  name: "Pessoa de Teste",
  email: "teste@example.com",
  organization: "Pousada de teste",
  interest: "Hotel ou pousada",
  message: "Quero conhecer a proposta para minha pousada.",
  consent: true,
  website: "",
};
function database() {
  const sqlite = openDatabase(":memory:");
  migrateContacts(sqlite);
  return { db: sqlite, sqlite };
}
test("validates required consent, subject, message limits and email", () => {
  assert.equal(contactSchema.safeParse({ ...valid, consent: false }).success, false);
  assert.equal(contactSchema.safeParse({ ...valid, email: "inválido" }).success, false);
  assert.equal(contactSchema.safeParse({ ...valid, interest: "Reserva paga" }).success, false);
  assert.equal(contactSchema.safeParse({ ...valid, message: "a".repeat(2001) }).success, false);
  assert.equal(contactSchema.safeParse({ ...valid, website: "spam.example" }).success, false);
  assert.equal(contactSchema.safeParse({ ...valid, admin: true }).success, false);
  assert.equal(
    contactSchema.parse({ ...valid, name: "  Pessoa  ", email: "TESTE@example.com" }).name,
    "Pessoa",
  );
});
test("persists contact, consent version and timestamp", async () => {
  const { db, sqlite } = database();
  const result = await createContact(db, valid, crypto.randomUUID(), "127.0.0.1");
  const row = sqlite.prepare("SELECT * FROM contacts WHERE id = ?").get(result.id) as Record<
    string,
    unknown
  >;
  assert.equal(row?.email, valid.email);
  assert.equal(row?.privacy_version, "2026-09-29-node");
  assert.ok(row?.consent_at);
  sqlite.close();
});
test("same idempotency key never creates two contacts, including concurrent retries", async () => {
  const { db, sqlite } = database();
  const key = crypto.randomUUID();
  const results = await Promise.all([
    createContact(db, valid, key, "127.0.0.1"),
    createContact(db, valid, key, "127.0.0.1"),
  ]);
  assert.equal(results[0].id, results[1].id);
  assert.equal(sqlite.prepare<[], { n: number }>("SELECT COUNT(*) n FROM contacts").get()?.n, 1);
  sqlite.close();
});
test("rejects key reused for a different payload", async () => {
  const { db, sqlite } = database();
  const key = crypto.randomUUID();
  await createContact(db, valid, key, "127.0.0.1");
  await assert.rejects(
    createContact(db, { ...valid, message: "Outra mensagem diferente" }, key, "127.0.0.1"),
    (e: unknown) => e instanceof HttpError && e.status === 409,
  );
  sqlite.close();
});
test("rate limit blocks sixth new contact and preserves stored rows", async () => {
  const { db, sqlite } = database();
  for (let i = 0; i < 5; i++) await createContact(db, valid, crypto.randomUUID(), "127.0.0.1");
  await assert.rejects(
    createContact(db, valid, crypto.randomUUID(), "127.0.0.1"),
    (e: unknown) => e instanceof HttpError && e.status === 429,
  );
  assert.equal(sqlite.prepare<[], { n: number }>("SELECT COUNT(*) n FROM contacts").get()?.n, 5);
  sqlite.close();
});
test("IP quota also limits submissions using different emails", async () => {
  const { db, sqlite } = database();
  for (let i = 0; i < 30; i++)
    await createContact(
      db,
      { ...valid, email: "test" + i + "@example.com" },
      crypto.randomUUID(),
      "127.0.0.1",
    );
  await assert.rejects(
    createContact(db, { ...valid, email: "other@example.com" }, crypto.randomUUID(), "127.0.0.1"),
    (e: unknown) => e instanceof HttpError && e.status === 429,
  );
  sqlite.close();
});
test("SQL-like input is stored as text without changing schema", async () => {
  const { db, sqlite } = database();
  await createContact(
    db,
    { ...valid, name: "Robert'); DROP TABLE contacts;--" },
    crypto.randomUUID(),
    "127.0.0.1",
  );
  assert.equal(sqlite.prepare<[], { n: number }>("SELECT COUNT(*) n FROM contacts").get()?.n, 1);
  sqlite.close();
});
test("invalid input and missing idempotency key never create a record", async () => {
  const { db, sqlite } = database();
  await assert.rejects(
    createContact(db, { ...valid, consent: false }, crypto.randomUUID(), "local"),
  );
  await assert.rejects(createContact(db, valid, null, "local"));
  assert.equal(sqlite.prepare<[], { n: number }>("SELECT COUNT(*) n FROM contacts").get()?.n, 0);
  sqlite.close();
});
test("requires same-origin JSON, limits bytes, handles invalid JSON", async () => {
  const make = (body: string, origin = "https://site.test", type = "application/json") =>
    new Request("https://site.test/api/contatos", {
      method: "POST",
      headers: { origin, "content-type": type },
      body,
    });
  await assert.rejects(
    readJson(make("{}", "https://evil.test")),
    (e: unknown) => e instanceof HttpError && e.status === 403,
  );
  await assert.rejects(
    readJson(make("{}", "https://site.test", "text/plain")),
    (e: unknown) => e instanceof HttpError && e.status === 415,
  );
  await assert.rejects(
    readJson(make("x".repeat(12001))),
    (e: unknown) => e instanceof HttpError && e.status === 413,
  );
  await assert.rejects(
    readJson(make("{")),
    (e: unknown) => e instanceof HttpError && e.status === 400,
  );
  assert.deepEqual(await readJson(make("{}")), {});
});
test("admin access fails closed and uses exact email matches", () => {
  assert.equal(isAdmin("admin@example.com", undefined), false);
  assert.equal(isAdmin(null, "admin@example.com"), false);
  assert.equal(isAdmin("attacker@example.com", "admin@example.com"), false);
  assert.equal(isAdmin("admin@example.com.evil", "admin@example.com"), false);
  assert.equal(isAdmin("ADMIN@example.com", " admin@example.com, second@example.com"), true);
});
test("consistent errors never expose internal failures", async () => {
  const response = errorResponse(new Error("database secret"), "test-request");
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(JSON.stringify(await response.json()).includes("database secret"), false);
  assert.equal(
    errorResponse(new HttpError(429, "RATE_LIMIT", "Aguarde"), "test").headers.get("retry-after"),
    "3600",
  );
});
test("database has idempotency and chronological indexes", () => {
  const { sqlite } = database();
  const plan = sqlite
    .prepare("EXPLAIN QUERY PLAN SELECT * FROM contacts WHERE idempotency_key = ?")
    .all("x");
  assert.match(JSON.stringify(plan), /idx_contacts_idempotency/);
  sqlite.close();
});
