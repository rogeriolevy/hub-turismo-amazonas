import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { betterAuth } from "better-auth";
import { openDatabase } from "../db/index.ts";
import { migrateDatabase } from "../db/migrate-auth.ts";
import { authOptions } from "../server/auth-config.ts";
import {
  resetAdminPassword,
  resetLocalAccountPassword,
  verifyStoredPassword,
} from "../scripts/admin-credentials.ts";

test("admin recovery validates its input, persists the new password and revokes existing sessions", async () => {
  const previous = {
    secret: process.env.BETTER_AUTH_SECRET,
    url: process.env.SITE_URL,
    emails: process.env.ADMIN_EMAILS,
  };
  const db = openDatabase(":memory:");
  const email = "admin@example.test";
  const password = randomBytes(32).toString("base64url");
  try {
    process.env.BETTER_AUTH_SECRET = randomBytes(48).toString("base64url");
    process.env.SITE_URL = "http://127.0.0.1:3100";
    process.env.ADMIN_EMAILS = email;
    await migrateDatabase(db);
    const auth = betterAuth(authOptions(db, true));
    await auth.api.signUpEmail({ body: { email, password, name: "Teste" } });
    await verifyStoredPassword(db, email, password);
    await auth.api.signInEmail({ body: { email, password } });
    assert.equal(db.prepare<[], { n: number }>("SELECT count(*) n FROM session").get()?.n, 1);
    await assert.rejects(resetAdminPassword(db, "other@example.test", password), /ADMIN_EMAILS/);
    for (const invalid of ["curta", "x".repeat(129)])
      await assert.rejects(resetAdminPassword(db, email, invalid), /12 e 128/);
    await verifyStoredPassword(db, email, password);
    assert.equal(db.prepare<[], { n: number }>("SELECT count(*) n FROM session").get()?.n, 1);

    const replacement = " Árvores-🌳-" + randomBytes(16).toString("base64url") + "! ";
    await resetAdminPassword(db, " ADMIN@example.test ", replacement);
    await verifyStoredPassword(db, email, replacement);
    await assert.rejects(verifyStoredPassword(db, email, password));
    await assert.rejects(verifyStoredPassword(db, email, replacement.trim()));
    assert.equal(db.prepare<[], { n: number }>("SELECT count(*) n FROM session").get()?.n, 0);
    await auth.api.signInEmail({ body: { email, password: replacement } });
    assert.equal(db.prepare<[], { n: number }>("SELECT count(*) n FROM session").get()?.n, 1);

    const touristEmail = "tourist@example.test";
    await auth.api.signUpEmail({ body: { email: touristEmail, password, name: "Turista" } });
    await auth.api.signInEmail({ body: { email: touristEmail, password } });
    await assert.rejects(resetAdminPassword(db, touristEmail, replacement), /ADMIN_EMAILS/);
    await assert.rejects(
      resetLocalAccountPassword(db, "missing@example.test", replacement),
      /inexistente/,
    );
    await resetLocalAccountPassword(db, touristEmail, replacement);
    await verifyStoredPassword(db, touristEmail, replacement);
    await assert.rejects(verifyStoredPassword(db, touristEmail, password));
    assert.equal(db.prepare<[], { n: number }>("SELECT count(*) n FROM session").get()?.n, 1);
    assert.equal(
      db.prepare<[], { n: number }>("SELECT count(*) n FROM company_members").get()?.n,
      0,
    );
  } finally {
    db.close();
    for (const [name, value] of Object.entries({
      BETTER_AUTH_SECRET: previous.secret,
      SITE_URL: previous.url,
      ADMIN_EMAILS: previous.emails,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
