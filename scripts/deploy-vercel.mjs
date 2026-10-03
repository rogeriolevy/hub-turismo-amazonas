import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = process.argv[2] || "preview";
if (!new Set(["preview", "production"]).has(target)) {
  console.error("Uso: npm run deploy:vercel -- [preview|production]");
  process.exit(2);
}

function run(command, args, { capture = false } = {}) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, {
      cwd: root,
      env: process.env,
      shell: process.platform === "win32",
      stdio: ["inherit", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (!capture) process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      if (!capture) process.stderr.write(chunk);
    });
    child.on("error", (error) => resolveRun({ code: 1, stdout, stderr: stderr + error.message }));
    child.on("close", (code) => resolveRun({ code: code ?? 1, stdout, stderr }));
  });
}

async function assertVercelStorageReady() {
  const database = await readFile(resolve(root, "db/index.ts"), "utf8");
  const imageRoute = await readFile(
    resolve(root, "app/api/plataforma/conteudos/imagens/route.ts"),
    "utf8",
  );
  const catalogService = await readFile(resolve(root, "server/catalog-content-service.ts"), "utf8");
  const blockers = [];

  if (/from\s+["']better-sqlite3["']/.test(database) && /new Database\(/.test(database))
    blockers.push("O banco ainda usa SQLite em arquivo local (db/index.ts).");
  if (
    /writeFile\(/.test(imageRoute) &&
    ['"public"', '"uploads"', '"catalog"'].every((part) => imageRoute.includes(part))
  )
    blockers.push("O envio de imagens ainda grava em public/uploads, no disco local.");
  if (
    /unlinkSync/.test(catalogService) &&
    /uploads/.test(catalogService) &&
    /catalog/.test(catalogService)
  )
    blockers.push("A remoção de imagens ainda depende do filesystem local.");

  if (!blockers.length) return;

  console.error(
    "Deploy interrompido antes de chamar a Vercel. Este projeto ainda não está pronto para produção nela:",
  );
  for (const blocker of blockers) console.error("- " + blocker);
  console.error(
    "Migre os dados/sessões para um banco gerenciado e as imagens para armazenamento de objetos; depois atualize esta pré-checagem. Não use /tmp como banco: ele não é persistente nem compartilhado entre funções.",
  );
  console.error("Consulte docs/VERCEL.md para o roteiro e as referências oficiais.");
  process.exit(2);
}

async function ensureProjectLinked() {
  try {
    await access(resolve(root, ".vercel/project.json"));
  } catch {
    console.log("Vincule esta pasta a um projeto Vercel (ou crie um novo).");
    const result = await run("vercel", ["link"]);
    if (result.code !== 0) throw new Error("Não foi possível vincular o projeto à Vercel.");
  }
}

async function ensureEnvironment(targetEnvironment) {
  const result = await run("vercel", ["env", "ls", targetEnvironment], { capture: true });
  if (result.code !== 0) {
    console.error(result.stderr || result.stdout);
    throw new Error("Não foi possível ler as variáveis Vercel de " + targetEnvironment + ".");
  }
  const listing = result.stdout + "\n" + result.stderr;
  const required = [
    "SITE_URL",
    "BETTER_AUTH_SECRET",
    "ADMIN_EMAILS",
    "TURNSTILE_SITE_KEY",
    "TURNSTILE_SECRET_KEY",
  ];
  const missing = required.filter(
    (name) => !new RegExp("(^|\\W)" + name + "(\\W|$)").test(listing),
  );
  if (missing.length)
    throw new Error(
      "Configure estas variáveis em Vercel → Settings → Environment Variables (" +
        targetEnvironment +
        "): " +
        missing.join(", ") +
        ". Não reutilize as chaves de teste do Turnstile.",
    );
}

try {
  await assertVercelStorageReady();

  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major !== 22 || minor < 13)
    throw new Error(
      "Este projeto requer Node.js 22.13 ou superior da linha 22; atual: " + process.version + ".",
    );

  let result = await run("vercel", ["whoami"]);
  if (result.code !== 0)
    throw new Error(
      "Instale a Vercel CLI (npm install --global vercel) e autentique com vercel login.",
    );

  await ensureProjectLinked();
  await ensureEnvironment(target);

  for (const [command, args] of [
    ["npm", ["run", "typecheck"]],
    ["npm", ["run", "lint"]],
    ["npm", ["test"]],
  ]) {
    result = await run(command, args);
    if (result.code !== 0)
      throw new Error(command + " " + args.join(" ") + " falhou; deploy cancelado.");
  }

  result = await run("vercel", target === "production" ? ["deploy", "--prod"] : ["deploy"]);
  if (result.code !== 0) throw new Error("A Vercel CLI não concluiu o deploy.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
