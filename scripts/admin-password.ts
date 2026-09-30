import { openDatabase } from "../db/index.ts";
import { isAdmin } from "../server/authorization.ts";
import { newPassword } from "./password-prompt.ts";
import { resetAdminPassword } from "./admin-credentials.ts";
const email = (process.argv[2] || process.env.ADMIN_EMAILS?.split(",")[0] || "")
  .trim()
  .toLowerCase();
if (!isAdmin(email, process.env.ADMIN_EMAILS))
  throw new Error("Este e-mail não consta em ADMIN_EMAILS.");
const db = openDatabase();
try {
  if (!db.prepare('SELECT id FROM "user" WHERE email = ?').get(email))
    throw new Error("Conta inexistente. Use npm run admin:create.");
  console.log(`Redefinindo o acesso de ${email}.`);
  await resetAdminPassword(db, email, await newPassword());
  console.log(
    `Senha atualizada e verificada no banco; sessões anteriores encerradas. Entre em ${process.env.SITE_URL}/admin.`,
  );
} finally {
  db.close();
}
