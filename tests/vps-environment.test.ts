import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const checkerPath = resolve(repositoryRoot, "scripts/check-vps-env.mjs");
const packagePath = resolve(repositoryRoot, "package.json");
const packageVersion = JSON.parse(readFileSync(packagePath, "utf8")).version as string;
const environmentKeys = [
  "SITE_URL",
  "APP_VERSION",
  "BETTER_AUTH_SECRET",
  "ADMIN_EMAILS",
  "TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
  "POSTGRES_DB",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "HUB_DB_USER",
  "HUB_DB_PASSWORD",
  "OSM_NOMINATIM_URL",
  "OSM_OVERPASS_URL",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_FROM",
  "BOOKING_EMAIL_NOTIFICATIONS",
  "REQUIRE_EMAIL_VERIFICATION",
];

function validEnvironment(version = packageVersion) {
  const hostSuffix = randomUUID().replaceAll("-", "").slice(0, 12);
  return [
    `SITE_URL=https://hub-vps-check-${hostSuffix}.com`,
    `APP_VERSION=${version}`,
    `BETTER_AUTH_SECRET=${randomUUID()}-${randomUUID()}-secret`,
    `ADMIN_EMAILS=admin@hub-vps-check-${hostSuffix}.com`,
    "TURNSTILE_SITE_KEY=synthetic-site-key-for-tests",
    "TURNSTILE_SECRET_KEY=synthetic-secret-key-for-tests",
    "POSTGRES_DB=hub_vps_test",
    "POSTGRES_USER=hub_admin_test",
    `POSTGRES_PASSWORD=${"a".repeat(64)}`,
    "HUB_DB_USER=hub_app_test",
    `HUB_DB_PASSWORD=${"b".repeat(64)}`,
    "BOOKING_EMAIL_NOTIFICATIONS=false",
    "REQUIRE_EMAIL_VERIFICATION=false",
  ].join("\n");
}

function runChecker(envFile: string, contents: string) {
  writeFileSync(envFile, contents, { mode: 0o600 });
  const childEnvironment = { ...process.env };
  for (const name of environmentKeys) delete childEnvironment[name];

  return spawnSync(process.execPath, [`--env-file=${envFile}`, checkerPath, envFile, packagePath], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: childEnvironment,
  });
}

test("VPS environment precheck accepts a valid local config without printing secrets", (context) => {
  const envFile = join(tmpdir(), `hub-vps-check-${randomUUID()}.env`);
  context.after(() => rmSync(envFile, { force: true }));

  const contents = validEnvironment();
  const secret = /^BETTER_AUTH_SECRET=(.+)$/m.exec(contents)?.[1] ?? "";
  const result = runChecker(envFile, contents);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Configuração VPS validada/);
  assert.equal((result.stdout + result.stderr).includes(secret), false);
});

test("VPS environment precheck rejects example hosts and a version mismatch", (context) => {
  const envFile = join(tmpdir(), `hub-vps-check-${randomUUID()}.env`);
  context.after(() => rmSync(envFile, { force: true }));

  const contents = validEnvironment("99.0.0").replace(
    /^SITE_URL=.*$/m,
    "SITE_URL=https://hub.example.com",
  );
  const result = runChecker(envFile, contents);
  const output = result.stdout + result.stderr;

  assert.equal(result.status, 1);
  assert.match(output, /SITE_URL precisa ser a origem HTTPS real/);
  assert.match(output, /APP_VERSION precisa corresponder/);
  assert.equal(output.includes("a".repeat(64)), false);
  assert.equal(output.includes("b".repeat(64)), false);
});
