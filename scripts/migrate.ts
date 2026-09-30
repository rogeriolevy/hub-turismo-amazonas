import { openDatabase } from "../db/index.ts";
import { migrateDatabase } from "../db/migrate-auth.ts";
const db = openDatabase();
try {
  await migrateDatabase(db);
  console.log("Banco de contatos, autenticação e plataforma atualizado.");
} finally {
  db.close();
}
