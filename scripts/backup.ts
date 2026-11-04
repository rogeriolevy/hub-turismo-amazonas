import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { openDatabase } from "../db/index.ts";
import { createCatalogMediaManifest } from "./catalog-media-manifest.ts";

if (process.env.DATABASE_URL || process.env.POSTGRES_URL)
  throw new Error("PostgreSQL está configurado; use o backup PostgreSQL da pasta infra/.");

process.umask(0o077);

const source = resolve(process.env.DATABASE_PATH || "data/hub.sqlite");
const destination = resolve(
  process.argv[2] ||
    (process.env.BACKUP_DIRECTORY || "backups") +
      "/hub-" +
      new Date().toISOString().replace(/[:.]/g, "-") +
      ".sqlite",
);
const manifestDestination = `${destination}.media.json`;
const temporary = `${destination}.partial-${randomUUID()}`;
const temporaryManifest = `${manifestDestination}.partial-${randomUUID()}`;

if (destination === source) throw new Error("O backup deve usar outro arquivo.");
if (existsSync(destination))
  throw new Error("O destino do backup já existe. Escolha um novo arquivo.");
if (existsSync(manifestDestination))
  throw new Error("O manifesto do backup já existe. Escolha um novo arquivo.");
if (!existsSync(source)) throw new Error("Banco de origem não encontrado.");
mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
const db = openDatabase(source);
let published = false;
let backupPublished = false;
let manifestPublished = false;
try {
  db.prepare("SELECT id FROM contacts LIMIT 1").get();
  await db.backup(temporary);

  const backup = new Database(temporary, { readonly: true, fileMustExist: true });
  try {
    if (backup.pragma("integrity_check", { simple: true }) !== "ok")
      throw new Error("A cópia SQLite não passou na verificação de integridade.");
    backup.prepare("SELECT id FROM contacts LIMIT 1").get();
  } finally {
    backup.close();
  }

  const manifest = await createCatalogMediaManifest(temporary, resolve("public/uploads/catalog"));
  writeFileSync(temporaryManifest, JSON.stringify(manifest, null, 2) + "\n", {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });

  chmodSync(temporary, 0o600);
  chmodSync(temporaryManifest, 0o600);
  if (existsSync(destination))
    throw new Error("O destino do backup já existe. Escolha um novo arquivo.");
  if (existsSync(manifestDestination))
    throw new Error("O manifesto do backup já existe. Escolha um novo arquivo.");
  renameSync(temporary, destination);
  backupPublished = true;
  renameSync(temporaryManifest, manifestDestination);
  manifestPublished = true;
  published = true;
  console.log("Backup consistente criado em " + destination);
  console.log("Manifesto de imagens criado em " + manifestDestination);
} finally {
  try {
    db.close();
  } finally {
    if (!published) {
      if (existsSync(temporary)) unlinkSync(temporary);
      if (existsSync(temporaryManifest)) unlinkSync(temporaryManifest);
      if (backupPublished && existsSync(destination)) unlinkSync(destination);
      if (manifestPublished && existsSync(manifestDestination)) unlinkSync(manifestDestination);
    }
  }
}
