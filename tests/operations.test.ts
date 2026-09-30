import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { openDatabase } from "../db/index.ts";
import { migrateContacts } from "../db/migrate.ts";
import { migrateDatabase } from "../db/migrate-auth.ts";
import { getClientIp } from "../server/client-ip.ts";
import { authOptions } from "../server/auth-config.ts";
import { createContact } from "../server/contact-service.ts";

test("migration can run twice and persistence survives reopening", async () => {
  mkdirSync("tmp", { recursive: true });
  const dir = mkdtempSync(resolve("tmp/operations-"));
  const filename = resolve(dir, "hub.sqlite");
  let db = openDatabase(filename);
  try {
    migrateContacts(db);
    migrateContacts(db);
    await createContact(
      db,
      {
        name: "Teste local",
        email: "test@example.test",
        interest: "Conhecer a solução",
        message: "Mensagem de verificação local.",
        consent: true,
      },
      crypto.randomUUID(),
      "local",
    );
    db.close();
    db = openDatabase(filename);
    assert.equal(db.prepare<[], { n: number }>("SELECT COUNT(*) n FROM contacts").get()?.n, 1);
    assert.equal(
      db.prepare<[], { n: number }>("SELECT COUNT(*) n FROM schema_migrations").get()?.n,
      3,
    );
    const backupPath = resolve(dir, "backup.sqlite");
    const backup = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "scripts/backup.ts", backupPath],
      {
        encoding: "utf8",
        env: { ...process.env, DATABASE_PATH: filename },
      },
    );
    assert.equal(backup.status, 0, backup.stderr);
    const repeatedBackup = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "scripts/backup.ts", backupPath],
      {
        encoding: "utf8",
        env: { ...process.env, DATABASE_PATH: filename },
      },
    );
    assert.notEqual(repeatedBackup.status, 0, "backup must never overwrite an existing file");
    const restoredPath = resolve(dir, "restored.sqlite");
    const result = spawnSync(process.execPath, ["scripts/restore.mjs", backupPath, restoredPath], {
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    const restored = openDatabase(restoredPath);
    assert.equal(
      restored.prepare<[], { n: number }>("SELECT COUNT(*) n FROM contacts").get()?.n,
      1,
    );
    restored.close();
    const duplicate = spawnSync(
      process.execPath,
      ["scripts/restore.mjs", backupPath, restoredPath],
      { encoding: "utf8" },
    );
    assert.notEqual(duplicate.status, 0, "restore must never overwrite an existing database");
    assert.ok(existsSync(restoredPath));
  } finally {
    db.close();
    if (!dir.startsWith(resolve("tmp") + (process.platform === "win32" ? "\\" : "/")))
      throw new Error("Unsafe cleanup path");
    rmSync(dir, { recursive: true, force: true });
  }
});
test("client IP is trusted only through an explicitly configured proxy header", () => {
  const previous = process.env.TRUST_PROXY_IP_HEADER;
  try {
    delete process.env.TRUST_PROXY_IP_HEADER;
    assert.equal(
      getClientIp(new Headers({ "x-forwarded-for": "1.2.3.4", "x-hub-client-ip": "5.6.7.8" })),
      "127.0.0.1",
    );
    process.env.TRUST_PROXY_IP_HEADER = "x-real-ip";
    assert.equal(getClientIp(new Headers({ "x-real-ip": "1.2.3.4" })), "1.2.3.4");
    assert.equal(getClientIp(new Headers({ "x-real-ip": "invalid, 1.2.3.4" })), "127.0.0.1");
  } finally {
    if (previous === undefined) delete process.env.TRUST_PROXY_IP_HEADER;
    else process.env.TRUST_PROXY_IP_HEADER = previous;
  }
});
test("authentication schema migrates twice and credentials stay disabled without a secret", async () => {
  const db = openDatabase(":memory:");
  const secret = process.env.BETTER_AUTH_SECRET;
  const site = process.env.SITE_URL;
  try {
    delete process.env.BETTER_AUTH_SECRET;
    assert.throws(() => authOptions(db));
    process.env.BETTER_AUTH_SECRET = randomBytes(48).toString("base64url");
    process.env.SITE_URL = "http://127.0.0.1:3000";
    await migrateDatabase(db);
    await migrateDatabase(db);
    assert.equal(db.prepare<[], { n: number }>('SELECT COUNT(*) n FROM "user"').get()?.n, 0);
    assert.equal(authOptions(db).emailAndPassword.disableSignUp, true);
    process.env.SITE_URL = "http://public.example.test";
    assert.throws(() => authOptions(db), /HTTPS/);
  } finally {
    db.close();
    if (secret === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = secret;
    if (site === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = site;
  }
});
