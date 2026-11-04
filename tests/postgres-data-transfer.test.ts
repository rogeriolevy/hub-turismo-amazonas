import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { test } from "node:test";
import { openDatabase } from "../db/index.ts";
import { migrateDatabase } from "../db/migrate-auth.ts";
import { migratePostgresDatabase } from "../db/migrate-postgres.ts";
import { createCatalogMediaManifest } from "../scripts/catalog-media-manifest.ts";

const databaseUrl = process.env.TEST_DATABASE_URL;
const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

function quoteIdentifier(name: string) {
  return `"${name.replaceAll('"', '""')}"`;
}

const tableOrder = [
  "user",
  "account",
  "contacts",
  "companies",
  "company_members",
  "rooms",
  "guides",
  "tours",
  "departures",
  "bookings",
  "user_notifications",
  "booking_reminders",
  "stay_records",
  "platform_audit",
  "cadastur_imports",
  "cadastur_entries",
  "catalog_items",
  "catalog_media",
] as const;

test(
  "SQLite-to-PostgreSQL transfer previews, preserves records and media, and refuses overwrites",
  { skip: !databaseUrl },
  async () => {
    const root = mkdtempSync(join(tmpdir(), "hub-postgres-transfer-"));
    const sourcePath = resolve(root, "source.sqlite");
    const backupPath = resolve(root, "backup.sqlite");
    const uploadDirectory = resolve(root, "uploads");
    mkdirSync(uploadDirectory, { mode: 0o700 });
    const schemaName = `hub_transfer_${randomUUID().replaceAll("-", "")}`;
    const adminPool = new Pool({ connectionString: databaseUrl, max: 1 });
    const targetUrl = new URL(databaseUrl!);
    targetUrl.searchParams.set("options", `-c search_path=${schemaName},public`);
    targetUrl.searchParams.set("application_name", `hub-transfer-${schemaName}`);
    let schemaCreated = false;
    const source = openDatabase(sourcePath);
    let targetPool: Pool | undefined;

    const executeTransfer = (apply: boolean) =>
      spawnSync(
        process.execPath,
        [
          "--experimental-strip-types",
          "scripts/transfer-sqlite-postgres.ts",
          backupPath,
          `--uploads=${uploadDirectory}`,
          ...(apply ? ["--apply"] : []),
        ],
        {
          cwd: repositoryRoot,
          encoding: "utf8",
          timeout: 60_000,
          maxBuffer: 2 * 1024 * 1024,
          env: { ...process.env, DATABASE_URL: targetUrl.toString() },
        },
      );

    try {
      process.env.SITE_URL ||= "http://127.0.0.1:3005";
      process.env.BETTER_AUTH_SECRET ||= randomUUID() + randomUUID();
      await migrateDatabase(source);

      const now = new Date().toISOString();
      source
        .prepare(
          "INSERT INTO booking_email_worker_heartbeat (worker_id,state,last_seen_at) VALUES (?,?,?)",
        )
        .run("booking-email-worker", "running", now);
      const userId = randomUUID();
      const hotelId = randomUUID();
      const operatorId = randomUUID();
      const roomId = randomUUID();
      const guideId = randomUUID();
      const tourId = randomUUID();
      const departureId = randomUUID();
      const bookingId = randomUUID();
      const importId = randomUUID();
      const entryId = randomUUID();
      const localMediaName = `${randomUUID()}.png`;
      const storedMediaName = `${randomUUID()}.webp`;
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const webpHeader = Buffer.from("RIFF0000WEBP", "ascii");
      writeFileSync(join(uploadDirectory, localMediaName), pngHeader);

      source
        .prepare(
          'INSERT INTO "user" (id,name,email,emailVerified,createdAt,updatedAt) VALUES (?,?,?,?,?,?)',
        )
        .run(userId, "Conta preservada", `${userId}@transfer.test`, 1, now, now);
      source
        .prepare(
          "INSERT INTO account (id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)",
        )
        .run(randomUUID(), userId, "credential", userId, "preserved-password-hash", now, now);
      source
        .prepare(
          "INSERT INTO session (id,expiresAt,token,createdAt,updatedAt,userId) VALUES (?,?,?,?,?,?)",
        )
        .run(randomUUID(), now, randomUUID(), now, now, userId);
      source
        .prepare(
          "INSERT INTO verification (id,identifier,value,expiresAt,createdAt,updatedAt) VALUES (?,?,?,?,?,?)",
        )
        .run(randomUUID(), `${userId}@transfer.test`, "temporary-token", now, now, now);
      source
        .prepare(
          "INSERT INTO contacts (id,idempotency_key,fingerprint,name,email,organization,interest,message,consent_at,privacy_version,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          randomUUID(),
          randomUUID(),
          "a".repeat(64),
          "Contato preservado",
          `${userId}@transfer.test`,
          "Empresa teste",
          "Hospedagem",
          "Mensagem de teste de transferência.",
          now,
          "v1",
          now,
        );
      source
        .prepare(
          "INSERT INTO companies (id,kind,name,slug,city,description,status,created_at,trade_name,activity_type) VALUES (?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          hotelId,
          "hotel",
          "Razão social hotel",
          `hotel-${hotelId}`,
          "Manaus",
          "Hospedagem de teste para transferência.",
          "published",
          now,
          "Nome fantasia preservado",
          "hotel",
        );
      source
        .prepare(
          "INSERT INTO companies (id,kind,name,slug,city,description,status,created_at,trade_name,activity_type) VALUES (?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          operatorId,
          "operator",
          "Operadora de teste",
          `operador-${operatorId}`,
          "Maués",
          "Operadora para transferência.",
          "published",
          now,
          "Operadora Rio",
          "passeios",
        );
      source
        .prepare("INSERT INTO company_members (company_id,user_id,role) VALUES (?,?,?)")
        .run(hotelId, userId, "hotel_manager");
      source
        .prepare(
          "INSERT INTO rooms (id,company_id,code,name,capacity,price_cents,active,operational_status) VALUES (?,?,?,?,?,?,?,?)",
        )
        .run(roomId, hotelId, "A1", "Quarto preservado", 2, 25000, 1, "ready");
      source
        .prepare(
          "INSERT INTO guides (id,company_id,slug,name,bio,languages,published) VALUES (?,?,?,?,?,?,?)",
        )
        .run(guideId, operatorId, `guia-${guideId}`, "Guia preservado", "Bio", "pt", 1);
      source
        .prepare(
          "INSERT INTO tours (id,company_id,slug,name,description,city,duration_minutes,price_cents,guide_id,published) VALUES (?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          tourId,
          operatorId,
          `passeio-${tourId}`,
          "Passeio preservado",
          "Descrição",
          "Maués",
          120,
          10000,
          guideId,
          1,
        );
      source
        .prepare("INSERT INTO departures (id,tour_id,starts_at,capacity,active) VALUES (?,?,?,?,?)")
        .run(departureId, tourId, "2027-01-10T12:00:00.000Z", 8, 1);
      source
        .prepare(
          "INSERT INTO bookings (id,request_key,fingerprint,user_id,company_id,kind,room_id,departure_id,check_in,check_out,guests,customer_name,customer_email,notes,total_cents,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          bookingId,
          randomUUID(),
          "b".repeat(64),
          userId,
          hotelId,
          "hotel",
          roomId,
          null,
          "2027-01-10",
          "2027-01-12",
          2,
          "Cliente preservado",
          `${userId}@transfer.test`,
          "Observação",
          50000,
          "confirmed",
          now,
          now,
        );
      source
        .prepare(
          "INSERT INTO user_notifications (id,user_id,company_id,booking_id,event,created_at,read_at) VALUES (?,?,?,?,?,?,?)",
        )
        .run(randomUUID(), userId, hotelId, bookingId, "booking.requested", now, null);
      source
        .prepare(
          "INSERT INTO booking_reminders (id,user_id,company_id,booking_id,created_at,read_at) VALUES (?,?,?,?,?,?)",
        )
        .run(randomUUID(), userId, hotelId, bookingId, now, null);
      source
        .prepare(
          "INSERT INTO stay_records (booking_id,country,origin_city,checked_in_at,checked_out_at) VALUES (?,?,?,?,?)",
        )
        .run(bookingId, "Brasil", "Manaus", now, null);
      source
        .prepare(
          "INSERT INTO platform_audit (id,actor_id,company_id,action,entity_id,created_at) VALUES (?,?,?,?,?,?)",
        )
        .run(randomUUID(), userId, hotelId, "transfer.test", bookingId, now);
      source
        .prepare(
          "INSERT INTO cadastur_imports (id,actor_id,category,period,source_json,checksum,summary,payload,status,created_at,expires_at,committed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          importId,
          userId,
          "hospedagens",
          "2026-T3",
          "{}",
          "c".repeat(64),
          "{}",
          null,
          "committed",
          now,
          now,
          now,
        );
      source
        .prepare(
          "INSERT INTO cadastur_entries (id,category,external_id,name,uf,city,subtype,registry_status,valid_until,period,data_hash,source_json,import_id,imported_at,review_status,company_id,guide_id,phone,email,address,website,languages,units,beds,published) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          entryId,
          "hospedagens",
          "transfer-cadastur-001",
          "Hotel Cadastur preservado",
          "AM",
          "Manaus",
          "Hotel",
          "Regular",
          "2030-01-01",
          "2026-T3",
          "d".repeat(64),
          "{}",
          importId,
          now,
          "reviewed",
          hotelId,
          null,
          "+5592999999999",
          "hotel@example.test",
          "Rua de teste",
          "https://hotel.example.test",
          "pt,en",
          10,
          20,
          1,
        );
      source
        .prepare(
          "INSERT INTO catalog_media (name,content_type,content_base64,created_at) VALUES (?,?,?,?)",
        )
        .run(storedMediaName, "image/webp", webpHeader.toString("base64"), now);
      source
        .prepare(
          "INSERT INTO catalog_items (id,source_entry_id,category,name,slug,city,subtype,summary,description,details,address,phone,email,website,image_urls_json,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          randomUUID(),
          entryId,
          "hospedagens",
          "Perfil preservado",
          `perfil-${entryId}`,
          "Manaus",
          "Hotel",
          "Resumo",
          "Descrição",
          "Detalhes",
          "Endereço",
          "+5592999999999",
          "hotel@example.test",
          "https://hotel.example.test",
          JSON.stringify([
            `/uploads/catalog/${localMediaName}`,
            `/api/media/catalog/${storedMediaName}`,
            "https://assets.example.test/remote.webp",
          ]),
          "published",
          now,
          now,
        );

      await source.backup(backupPath);
      const mediaManifest = await createCatalogMediaManifest(backupPath, uploadDirectory);
      writeFileSync(`${backupPath}.media.json`, JSON.stringify(mediaManifest), { mode: 0o600 });

      await adminPool.query(`CREATE SCHEMA ${quoteIdentifier(schemaName)}`);
      schemaCreated = true;
      const testPool = new Pool({ connectionString: targetUrl.toString(), max: 2 });
      targetPool = testPool;
      await migratePostgresDatabase(testPool);

      const preview = executeTransfer(false);
      assert.equal(preview.status, 0, preview.stderr);
      assert.match(preview.stdout, /Prévia concluída; o PostgreSQL não foi alterado/);
      for (const table of tableOrder) {
        const result = await testPool.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM ${quoteIdentifier(table)}`,
        );
        assert.equal(result.rows[0].count, "0", `preview must not write ${table}`);
      }

      const apply = executeTransfer(true);
      assert.equal(apply.status, 0, apply.stderr);
      assert.match(apply.stdout, /Contagens confirmadas/);
      for (const table of tableOrder) {
        const sourceCount = source
          .prepare(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)}`)
          .get() as { count: number };
        const expectedCount = sourceCount.count + (table === "catalog_media" ? 1 : 0);
        const targetCount = await testPool.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM ${quoteIdentifier(table)}`,
        );
        assert.equal(Number(targetCount.rows[0].count), expectedCount, `${table} count preserved`);
      }

      const targetUser = await testPool.query<{ emailVerified: boolean }>(
        'SELECT "emailVerified" FROM "user" WHERE id=$1',
        [userId],
      );
      assert.equal(targetUser.rows[0].emailVerified, true);
      const targetNotification = await testPool.query<{
        user_id: string;
        company_id: string;
        booking_id: string;
        event: string;
      }>("SELECT user_id,company_id,booking_id,event FROM user_notifications WHERE booking_id=$1", [
        bookingId,
      ]);
      assert.deepEqual(targetNotification.rows[0], {
        user_id: userId,
        company_id: hotelId,
        booking_id: bookingId,
        event: "booking.requested",
      });
      const targetReminder = await testPool.query<{
        user_id: string;
        company_id: string;
        booking_id: string;
        read_at: string | null;
      }>(
        "SELECT user_id,company_id,booking_id,read_at FROM booking_reminders WHERE booking_id=$1",
        [bookingId],
      );
      assert.deepEqual(targetReminder.rows[0], {
        user_id: userId,
        company_id: hotelId,
        booking_id: bookingId,
        read_at: null,
      });
      const targetAccount = await testPool.query<{ password: string }>(
        'SELECT password FROM account WHERE "userId"=$1 AND "providerId"=\'credential\'',
        [userId],
      );
      assert.equal(targetAccount.rows[0].password, "preserved-password-hash");
      const targetEntry = await testPool.query<{ company_id: string | null }>(
        "SELECT company_id FROM cadastur_entries WHERE id=$1",
        [entryId],
      );
      assert.equal(targetEntry.rows[0].company_id, hotelId);
      const targetCatalog = await testPool.query<{ image_urls_json: string }>(
        "SELECT image_urls_json FROM catalog_items WHERE source_entry_id=$1",
        [entryId],
      );
      assert.deepEqual(JSON.parse(targetCatalog.rows[0].image_urls_json), [
        `/api/media/catalog/${localMediaName}`,
        `/api/media/catalog/${storedMediaName}`,
        "https://assets.example.test/remote.webp",
      ]);
      const storedMedia = await testPool.query<{ content_base64: string }>(
        "SELECT content_base64 FROM catalog_media WHERE name=$1",
        [storedMediaName],
      );
      assert.equal(storedMedia.rows[0].content_base64, webpHeader.toString("base64"));
      const localMedia = await testPool.query<{ content_base64: string }>(
        "SELECT content_base64 FROM catalog_media WHERE name=$1",
        [localMediaName],
      );
      assert.equal(localMedia.rows[0].content_base64, pngHeader.toString("base64"));
      const sessions = await testPool.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM "session"',
      );
      assert.equal(sessions.rows[0].count, "0", "old sessions are not transferred");
      const workerHeartbeats = await testPool.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM booking_email_worker_heartbeat",
      );
      assert.equal(workerHeartbeats.rows[0].count, "0", "old process state is not transferred");

      const repeat = executeTransfer(true);
      assert.notEqual(repeat.status, 0, "non-empty destinations must never be overwritten");
      assert.match(repeat.stderr, /já tem dados/);
    } finally {
      source.close();
      await targetPool?.end();
      if (schemaCreated)
        await adminPool.query(`DROP SCHEMA ${quoteIdentifier(schemaName)} CASCADE`);
      await adminPool.end();
      const temporaryRoot = resolve(tmpdir()) + sep;
      if (!root.startsWith(temporaryRoot)) throw new Error("Unsafe transfer-test cleanup path");
      if (existsSync(root)) rmSync(root, { recursive: true, force: true });
    }
  },
);
