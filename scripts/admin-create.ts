import { betterAuth } from "better-auth";
import { isPostgresDatabase, one, openManagementDatabase } from "../db/index.ts";
import { migratePostgresDatabase } from "../db/migrate-postgres.ts";
import { authOptions } from "../server/auth-config.ts";
import { isAdmin } from "../server/authorization.ts";
import { newPassword } from "./password-prompt.ts";
import { verifyStoredPassword } from "./admin-credentials.ts";
const email = (process.argv[2] || process.env.ADMIN_EMAILS?.split(",")[0] || "")
  .trim()
  .toLowerCase();
if (!isAdmin(email, process.env.ADMIN_EMAILS))
  throw new Error("Este e-mail não consta em ADMIN_EMAILS.");
const db = openManagementDatabase();
try {
  if (isPostgresDatabase(db)) await migratePostgresDatabase(db);
  if (await one<{ id: string }>(db, 'SELECT id FROM "user" WHERE email = ?', email))
    throw new Error("Conta existente. Use npm run admin:password para recuperar o acesso.");
  console.log(`Criando acesso para ${email}.`);
  const password = await newPassword();
  // Provisioning exists only in this local CLI instance; the HTTP app never enables signup.
  const auth = betterAuth(authOptions(db, true));
  await auth.api.signUpEmail({ body: { email, name: "Administrador", password } });
  await verifyStoredPassword(db, email, password);
  console.log(
    `Conta administrativa criada e senha verificada no banco. Entre em ${process.env.SITE_URL}/admin.`,
  );
} finally {
  if (isPostgresDatabase(db)) await db.end();
  else db.close();
}
