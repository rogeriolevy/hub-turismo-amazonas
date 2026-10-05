import { isPostgresDatabase, one, openManagementDatabase } from "../db/index.ts";
import { migratePostgresDatabase } from "../db/migrate-postgres.ts";
import { isAdmin } from "../server/authorization.ts";
import { newPassword } from "./password-prompt.ts";
import { resetAdminPassword } from "./admin-credentials.ts";
const email = (process.argv[2] || process.env.ADMIN_EMAILS?.split(",")[0] || "")
  .trim()
  .toLowerCase();
if (!isAdmin(email, process.env.ADMIN_EMAILS))
  throw new Error("Este e-mail não consta em ADMIN_EMAILS.");
const db = openManagementDatabase();
try {
  if (isPostgresDatabase(db)) await migratePostgresDatabase(db);
  if (!(await one<{ id: string }>(db, 'SELECT id FROM "user" WHERE email = ?', email)))
    throw new Error("Conta inexistente. Use npm run admin:create.");
  console.log(`Redefinindo o acesso de ${email}.`);
  await resetAdminPassword(db, email, await newPassword());
  console.log(
    `Senha atualizada e verificada no banco; sessões anteriores encerradas. Entre em ${process.env.SITE_URL}/admin.`,
  );
} finally {
  if (isPostgresDatabase(db)) await db.end();
  else db.close();
}
