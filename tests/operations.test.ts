import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { openDatabase } from "../db/index.ts";
import { migrateContacts } from "../db/migrate.ts";
import { migrateDatabase } from "../db/migrate-auth.ts";
import { getClientIp } from "../server/client-ip.ts";
import { authOptions } from "../server/auth-config.ts";
import { createContact } from "../server/contact-service.ts";
import { searchProviders } from "../server/cadastur/public-directory.ts";
import { searchExperiences } from "../server/experience-directory-service.ts";

test("migration can run twice and persistence survives reopening", async () => {
  mkdirSync("tmp", { recursive: true });
  const dir = mkdtempSync(resolve("tmp/operations-"));
  const filename = resolve(dir, "hub.sqlite");
  let db = openDatabase(filename);
  try {
    migrateContacts(db);
    const appliedMigrationCount =
      db.prepare<[], { n: number }>("SELECT COUNT(*) n FROM schema_migrations").get()?.n ?? 0;
    migrateContacts(db);
    assert.ok(appliedMigrationCount > 0, "migrations should be recorded");
    assert.equal(
      db.prepare<[], { n: number }>("SELECT COUNT(*) n FROM schema_migrations").get()?.n,
      appliedMigrationCount,
      "applying migrations twice must not add duplicate migration records",
    );
    assert.ok(
      db
        .prepare("SELECT 1 FROM schema_migrations WHERE name='018_guide_member_assignment.sql'")
        .get(),
      "the guide assignment migration is applied",
    );
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
test("trade name migration preserves existing company names and records", () => {
  const db = openDatabase(":memory:");
  try {
    db.exec(
      "CREATE TABLE schema_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)",
    );
    for (const name of ["001_contacts.sql", "002_platform.sql", "003_cadastur.sql"]) {
      const sql = readFileSync(
        new URL("../db/migrations/" + name, import.meta.url),
        "utf8",
      ).replace(/\r\n/g, "\n");
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations VALUES (?,?,?)").run(
        name,
        createHash("sha256").update(sql).digest("hex"),
        new Date().toISOString(),
      );
    }
    db.prepare("INSERT INTO companies VALUES (?,?,?,?,?,?,?,?)").run(
      "existing",
      "hotel",
      "Nome original",
      "hotel-original",
      "Manaus",
      "Empresa existente antes da migração.",
      "published",
      "2026-09-29T12:00:00Z",
    );
    const before = db.prepare("SELECT * FROM companies").get()!;
    migrateContacts(db);
    const appliedMigrationCount =
      db.prepare<[], { n: number }>("SELECT COUNT(*) n FROM schema_migrations").get()?.n ?? 0;
    migrateContacts(db);
    assert.deepEqual(db.prepare("SELECT * FROM companies").get(), {
      ...before,
      trade_name: "",
      activity_type: "hotel",
    });
    assert.equal(
      db.prepare<[], { n: number }>("SELECT COUNT(*) n FROM schema_migrations").get()!.n,
      appliedMigrationCount,
      "rerunning migrations must preserve the number of applied migration records",
    );
  } finally {
    db.close();
  }
});

test("public experience search preserves tour results on SQLite", async () => {
  process.env.SITE_URL ||= "http://127.0.0.1:3005";
  process.env.BETTER_AUTH_SECRET ||= randomBytes(48).toString("base64url");
  const db = openDatabase(":memory:");
  try {
    await migrateDatabase(db);
    const now = new Date().toISOString();
    const companyId = crypto.randomUUID();
    const tourId = crypto.randomUUID();
    db.prepare(
      "INSERT INTO companies (id,kind,name,slug,city,description,status,created_at) VALUES (?,?,?,?,?,?,?,?)",
    ).run(
      companyId,
      "operator",
      "Operadora de teste",
      `operadora-${companyId}`,
      "Maués",
      "Empresa de teste do diretório.",
      "published",
      now,
    );
    db.prepare(
      "INSERT INTO tours (id,company_id,slug,name,description,city,duration_minutes,price_cents,published) VALUES (?,?,?,?,?,?,?,?,?)",
    ).run(
      tourId,
      companyId,
      `passeio-${tourId}`,
      "Passeio de concorrência",
      "Descrição do passeio de teste.",
      "Maués",
      120,
      10000,
      1,
    );

    const page = await searchExperiences(db, { q: "Passeio de concorrência" });
    assert.ok(page.results.some((result) => result.kind === "tour" && result.tour.id === tourId));
    const mixedFieldPage = await searchExperiences(db, { q: "Maués Operadora" });
    assert.ok(
      mixedFieldPage.results.some((result) => result.kind === "tour" && result.tour.id === tourId),
      "multi-term search matches tour city and operator name",
    );
  } finally {
    db.close();
  }
});

test("public provider search matches every term across public fields on SQLite", async () => {
  process.env.SITE_URL ||= "http://127.0.0.1:3005";
  process.env.BETTER_AUTH_SECRET ||= randomBytes(48).toString("base64url");
  const db = openDatabase(":memory:");
  try {
    await migrateDatabase(db);
    const itemId = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO catalog_items (id,category,name,slug,city,subtype,summary,description,details,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      itemId,
      "guias",
      "Guia Beatriz",
      `guia-beatriz-${itemId}`,
      "Parintins",
      "Guia de turismo",
      "Atendimento em português e inglês.",
      "Experiência de teste do diretório.",
      "",
      "published",
      now,
      now,
    );

    const page = await searchProviders(db, "guias", { q: "Parintins Beatriz" });
    assert.ok(
      page.entries.some((entry) => entry.id === itemId),
      "all query terms match even when they appear in a different order",
    );
  } finally {
    db.close();
  }
});

test("guide assignment migration preserves legacy members as unlinked and prevents duplicate links", () => {
  const db = openDatabase(":memory:");
  try {
    db.exec(`
      CREATE TABLE guides (id TEXT PRIMARY KEY);
      CREATE TABLE company_members (
        company_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        PRIMARY KEY (company_id,user_id)
      );
      INSERT INTO company_members VALUES ('company','legacy-guide','guide');
    `);
    db.exec(readFileSync(resolve("db/migrations/018_guide_member_assignment.sql"), "utf8"));
    assert.deepEqual(db.prepare("SELECT role,guide_id FROM company_members").get(), {
      role: "guide",
      guide_id: null,
    });
    db.prepare("INSERT INTO guides (id) VALUES (?), (?)").run("guide-profile", "guide-profile-2");
    db.prepare("UPDATE company_members SET guide_id=? WHERE user_id=?").run(
      "guide-profile",
      "legacy-guide",
    );
    db.prepare(
      "INSERT INTO company_members (company_id,user_id,role,guide_id) VALUES (?,?,?,?)",
    ).run("company", "second-guide", "guide", "guide-profile-2");
    assert.throws(() =>
      db
        .prepare("INSERT INTO company_members (company_id,user_id,role,guide_id) VALUES (?,?,?,?)")
        .run("company", "second-guide-duplicate", "guide", "guide-profile-2"),
    );
  } finally {
    db.close();
  }
});

test("public directory migration preserves existing imports, entries and company links", () => {
  const db = openDatabase(":memory:");
  try {
    db.exec(
      "CREATE TABLE user (id TEXT PRIMARY KEY); INSERT INTO user VALUES ('admin'); CREATE TABLE schema_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)",
    );
    for (const name of [
      "001_contacts.sql",
      "002_platform.sql",
      "003_cadastur.sql",
      "004_company_trade_name.sql",
    ]) {
      const sql = readFileSync(
        new URL("../db/migrations/" + name, import.meta.url),
        "utf8",
      ).replace(/\r\n/g, "\n");
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations VALUES (?,?,?)").run(
        name,
        createHash("sha256").update(sql).digest("hex"),
        "2026-10-01",
      );
    }
    db.exec(
      "INSERT INTO companies (id,kind,name,slug,city,description,status,created_at) VALUES ('hotel','hotel','Hotel','hotel','Maués','Teste','draft','2026-10-01')",
    );
    db.exec(
      "INSERT INTO cadastur_imports VALUES ('batch','admin','hospedagens','2026-T2','{}','hash','{}',NULL,'committed','2026-10-01','2026-10-02','2026-10-01')",
    );
    db.exec(
      "INSERT INTO cadastur_entries VALUES ('entry','hospedagens','12345678000100','Hotel','AM','Maués','Hotel','Regular','','2026-T2','hash','{}','batch','2026-10-01','reviewed','hotel',NULL)",
    );
    const before = db.prepare("SELECT * FROM cadastur_entries").get();
    migrateContacts(db);
    assert.deepEqual(db.prepare("SELECT * FROM cadastur_entries").get(), {
      ...(before as object),
      phone: "",
      email: "",
      address: "",
      website: "",
      languages: "",
      units: null,
      beds: null,
      published: 0,
    });
    assert.deepEqual(db.pragma("foreign_key_check"), []);
    assert.equal(db.pragma("foreign_keys", { simple: true }), 1);
    assert.throws(() => db.prepare("DELETE FROM cadastur_imports WHERE id='batch'").run());
    assert.equal(
      db.prepare<[], { n: number }>("SELECT COUNT(*) n FROM cadastur_imports").get()!.n,
      1,
    );
  } finally {
    db.close();
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
