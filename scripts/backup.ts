import { existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { openDatabase } from "../db/index.ts";
const destination = resolve(
  process.argv[2] ||
    (process.env.BACKUP_DIRECTORY || "backups") +
      "/hub-" +
      new Date().toISOString().replace(/[:.]/g, "-") +
      ".sqlite",
);
if (destination === resolve(process.env.DATABASE_PATH || "data/hub.sqlite"))
  throw new Error("O backup deve usar outro arquivo.");
if (existsSync(destination))
  throw new Error("O destino do backup já existe. Escolha um novo arquivo.");
if (!existsSync(resolve(process.env.DATABASE_PATH || "data/hub.sqlite")))
  throw new Error("Banco de origem não encontrado.");
mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
const db = openDatabase();
try {
  db.prepare("SELECT id FROM contacts LIMIT 1").get();
  await db.backup(destination);
  console.log("Backup consistente criado em " + destination);
} finally {
  db.close();
}
