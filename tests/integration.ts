import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { resolve, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { betterAuth } from "better-auth";
import { openDatabase } from "../db/index.ts";
import { migrateDatabase } from "../db/migrate-auth.ts";
import { authOptions } from "../server/auth-config.ts";
import { resetAdminPassword, verifyStoredPassword } from "../scripts/admin-credentials.ts";
import { verifyPlatformHttp } from "./platform-http.ts";

mkdirSync("tmp", { recursive: true });
const directory = mkdtempSync(resolve("tmp/integration-"));
const base = "http://127.0.0.1:3100";
const email = "admin@example.test";
let password = ' Árvore@"$`\\-' + randomBytes(24).toString("base64url") + "! ";
process.env.SITE_URL = base;
process.env.DATABASE_PATH = resolve(directory, "hub.sqlite");
process.env.BETTER_AUTH_SECRET = randomBytes(48).toString("base64url");
process.env.ADMIN_EMAILS = email;
process.env.TRUST_PROXY_IP_HEADER = "";
const db = openDatabase();
let stopPreview = false;
const requestStop = () => {
  stopPreview = true;
};
if (process.argv.includes("--preview")) {
  process.on("SIGINT", requestStop);
  process.on("SIGTERM", requestStop);
}
await migrateDatabase(db);
const provision = betterAuth(authOptions(db, true));
await provision.api.signUpEmail({ body: { email, password, name: "Administrador de teste" } });
await verifyStoredPassword(db, email, password);
await provision.api.signUpEmail({
  body: { email: "other@example.test", password, name: "Sem permissão" },
});
process.env.TURNSTILE_SITE_KEY = "1x00000000000000000000AA";
process.env.TURNSTILE_SECRET_KEY = "1x0000000000000000000000000000000AA";
const server = spawn(
  process.execPath,
  process.argv.includes("--preview")
    ? ["tests/preview-server.mjs"]
    : ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3100"],
  {
    env: { ...process.env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
);
let logs = "";
server.stdout.on("data", (chunk) => {
  logs = (logs + chunk).slice(-10000);
});
server.stderr.on("data", (chunk) => {
  logs = (logs + chunk).slice(-10000);
});
const post = (path: string, body: unknown, extra: Record<string, string> = {}) =>
  fetch(base + path, {
    method: "POST",
    headers: {
      origin: base,
      "content-type": "application/json",
      "x-captcha-response": "XXXX.DUMMY.TOKEN.XXXX",
      ...extra,
    },
    body: JSON.stringify(body),
  });
const cookieFrom = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw new Error("Servidor encerrou: " + logs);
    try {
      if ((await fetch(base + "/api/health")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await delay(250);
  }
  assert.ok(ready, "Servidor não iniciou. " + logs);
  for (const path of [
    "/",
    "/privacidade",
    "/entrar",
    "/cadastro",
    "/hospedagens?entrada=2026-11-10&saida=2026-11-13&pessoas=2",
    "/navegacao",
    "/navegacao?origem=Mau%C3%A9s&destino=Manaus&modo=fluvial&data=2026-11-10&pessoas=2",
    "/admin",
    "/api/health",
    "/api/openapi",
    "/robots.txt",
    "/sitemap.xml",
  ])
    assert.equal((await fetch(base + path)).status, 200, path);
  const loginPage = await (await fetch(base + "/entrar")).text();
  const registrationPage = await (await fetch(base + "/cadastro")).text();
  const filteredNavigationPage = await (
    await fetch(
      base + "/navegacao?origem=Mau%C3%A9s&destino=Manaus&modo=fluvial&data=2026-11-10&pessoas=2",
    )
  ).text();
  assert.match(loginPage, /Boas histórias começam aqui/);
  assert.match(registrationPage, /Crie sua conta/);
  assert.match(registrationPage, /Celular com DDD/);
  assert.match(loginPage, /challenges\.cloudflare\.com\/turnstile/);
  assert.match(registrationPage, /challenges\.cloudflare\.com\/turnstile/);
  assert.match(loginPage, /data-sitekey="1x00000000000000000000AA"/);
  assert.match(registrationPage, /data-sitekey="1x00000000000000000000AA"/);
  const normalizedNavigationSearch = filteredNavigationPage
    .replace(/<!-- -->/g, "")
    .replace(/\s+/g, " ");
  assert.match(normalizedNavigationSearch, /1 trecho encontrado/);
  assert.match(normalizedNavigationSearch, /10\/11\/2026 · 2 passageiros/);
  const navigationPage = await (await fetch(base + "/navegacao")).text();
  assert.match(navigationPage, /Seu caminho/);
  assert.match(navigationPage, /Boa Vista do Ramos/);
  assert.match(navigationPage, /Sob consulta/);
  assert.match(navigationPage, /roteiro-folha-de-maues\.png/);
  assert.match(navigationPage, /25\/11\/2026/);
  assert.match(navigationPage, /tel:\+5592991517907/);
  assert.match(navigationPage, /Fonte e condições/);
  assert.match(await (await fetch(base + "/sitemap.xml")).text(), /\/navegacao/);
  for (const image of [
    "rios-e-ceus.webp",
    "roteiro-folha-de-maues.png",
    "roteiro-navegacao-pp.png",
  ]) {
    const asset = await fetch(base + "/images/navegacao/" + image);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get("content-type") || "", /^image\//);
  }
  assert.equal((await fetch(base + "/pagina-inexistente")).status, 404);
  assert.equal((await fetch(base + "/api/admin/contatos")).status, 401);
  assert.equal(
    (
      await fetch(base + "/api/auth/sign-in/email", {
        method: "POST",
        headers: { origin: base, "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
    ).status,
    400,
    "Login deve exigir um token antirobô verificado no servidor",
  );
  assert.equal(
    (
      await fetch(base + "/api/admin/contatos", {
        headers: { "oai-authenticated-user-email": email, "x-hub-client-ip": "1.2.3.4" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await post("/api/auth/sign-up/email", {
        email: "attacker@example.test",
        password,
        name: "Blocked",
      })
    ).status,
    404,
  );
  assert.equal((await post("/api/contatos", {})).status, 422);
  assert.equal((await post("/api/contatos", {}, { origin: "https://evil.example" })).status, 403);
  assert.equal(
    (await post("/api/auth/sign-in/email", { email, password }, { origin: "https://evil.example" }))
      .status,
    403,
  );
  const contact = {
    name: "Visitante de teste",
    email: "visitor@example.test",
    organization: "Ambiente de teste",
    interest: "Conhecer a solução",
    message: "Mensagem criada apenas para validar a versão local.",
    consent: true,
  };
  const key = randomUUID();
  assert.equal((await post("/api/contatos", contact, { "Idempotency-Key": key })).status, 201);
  assert.equal((await post("/api/contatos", contact, { "Idempotency-Key": key })).status, 200);
  assert.equal(
    (
      await post(
        "/api/contatos",
        { ...contact, message: "Outra mensagem para a mesma chave." },
        { "Idempotency-Key": key },
      )
    ).status,
    409,
  );
  const rejectedPasswordLogin = await post("/api/auth/sign-in/email", {
    email,
    password: randomUUID(),
  });
  assert.equal(rejectedPasswordLogin.status, 401, await rejectedPasswordLogin.text());
  const otherLogin = await post("/api/auth/sign-in/email", {
    email: "other@example.test",
    password,
  });
  assert.equal(otherLogin.status, 200);
  assert.equal(
    (await fetch(base + "/api/admin/contatos", { headers: { cookie: cookieFrom(otherLogin) } }))
      .status,
    403,
  );
  const login = await post("/api/auth/sign-in/email", { email, password });
  assert.equal(login.status, 200, "Senha criada no terminal deve funcionar no servidor HTTP");
  const cookie = cookieFrom(login);
  assert.ok(cookie);
  assert.match(login.headers.get("set-cookie") || "", /httponly/i);
  assert.match(login.headers.get("set-cookie") || "", /samesite=lax/i);
  const inbox = await fetch(base + "/api/admin/contatos", { headers: { cookie } });
  assert.equal(inbox.status, 200);
  assert.match(inbox.headers.get("cache-control") || "", /no-store/);
  const data = await inbox.json();
  assert.equal(data.total, 1);
  assert.equal(data.data[0].email, contact.email);
  assert.equal(
    (await fetch(base + "/api/admin/contatos?page=0", { headers: { cookie } })).status,
    400,
  );
  const emptyPage = await fetch(base + "/api/admin/contatos?page=2", { headers: { cookie } });
  assert.equal((await emptyPage.json()).data.length, 0);
  db.prepare("DELETE FROM rateLimit").run();
  const previousPassword = password;
  password = " Outra-Árvore-🌳-" + randomBytes(24).toString("base64url") + "! ";
  await resetAdminPassword(db, email, password);
  assert.equal((await fetch(base + "/api/admin/contatos", { headers: { cookie } })).status, 401);
  assert.equal(
    (await post("/api/auth/sign-in/email", { email, password: previousPassword })).status,
    401,
  );
  const recoveredLogin = await post("/api/auth/sign-in/email", { email, password });
  assert.equal(recoveredLogin.status, 200, "Nova senha deve funcionar sem reiniciar o servidor");
  const recoveredCookie = cookieFrom(recoveredLogin);
  assert.equal(
    (await fetch(base + "/api/admin/contatos", { headers: { cookie: recoveredCookie } })).status,
    200,
  );
  assert.equal((await post("/api/auth/sign-out", {}, { cookie: recoveredCookie })).status, 200);
  assert.equal(
    (await fetch(base + "/api/admin/contatos", { headers: { cookie: recoveredCookie } })).status,
    401,
  );
  let limited = false;
  for (let i = 0; i < 7; i++)
    if ((await post("/api/auth/sign-in/email", { email, password: randomUUID() })).status === 429) {
      limited = true;
      break;
    }
  assert.ok(limited, "Login deve limitar tentativas");
  console.log(
    "PASS: páginas, contato persistido, idempotência, origem, senha com acentos/espaços/símbolos, recuperação sem reiniciar, revogação de sessões, logout, cookies, cadastro bloqueado, 401/403, paginação e rate limit.",
  );
  const platformFixture = await verifyPlatformHttp(base, db, email, password, previousPassword);
  if (process.argv.includes("--preview")) {
    db.prepare("DELETE FROM rateLimit").run();
    const stopPath = resolve(directory, "stop");
    writeFileSync(
      "tmp/ui-preview.json",
      JSON.stringify({ base, email, password, stopPath, ...platformFixture }),
      {
        mode: 0o600,
      },
    );
    console.log("Prévia de QA isolada disponível em " + base);
    console.log("Revisão responsiva: " + base + "/__qa/layout");
    while (!stopPreview && !existsSync(stopPath)) await delay(250);
    rmSync("tmp/ui-preview.json");
  }
} finally {
  process.removeListener("SIGINT", requestStop);
  process.removeListener("SIGTERM", requestStop);
  const finished = once(server, "exit");
  if (server.exitCode === null) {
    server.kill();
    await finished;
  }
  db.close();
  if (!directory.startsWith(resolve("tmp") + sep)) throw new Error("Unsafe cleanup path");
  rmSync(directory, { recursive: true, force: true });
}
