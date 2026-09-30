import Database from "better-sqlite3";
import { copyFileSync, constants, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
const [source, destination] = process.argv.slice(2);
if (!source || !destination)
  throw new Error("Uso: npm run db:restore -- backup.sqlite novo-banco.sqlite");
const backup = new Database(resolve(source), { readonly: true, fileMustExist: true });
try {
  if (backup.pragma("integrity_check", { simple: true }) !== "ok")
    throw new Error("O backup não passou na verificação de integridade.");
  backup.prepare("SELECT id FROM contacts LIMIT 1").get();
} finally {
  backup.close();
}
mkdirSync(dirname(resolve(destination)), { recursive: true, mode: 0o700 });
copyFileSync(resolve(source), resolve(destination), constants.COPYFILE_EXCL);
console.log(
  "Banco restaurado em arquivo novo. Pare o servidor e ajuste DATABASE_PATH antes de usá-lo.",
);
