import { isPostgresDatabase, one, openManagementDatabase } from "../db/index.ts";
import { migratePostgresDatabase } from "../db/migrate-postgres.ts";
import { newPassword } from "./password-prompt.ts";
import { resetLocalAccountPassword } from "./admin-credentials.ts";

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email || !email.includes("@"))
  throw new Error("Informe o e-mail: npm run account:password -- EMAIL");
const db = openManagementDatabase();
try {
  if (isPostgresDatabase(db)) await migratePostgresDatabase(db);
  if (!(await one<{ id: string }>(db, 'SELECT id FROM "user" WHERE email = ?', email)))
    throw new Error("Conta inexistente. A recuperação não cria novas contas.");
  console.log(
    `Manutenção local da conta ${email}. Confirme a identidade da pessoa antes de redefinir.`,
  );
  await resetLocalAccountPassword(db, email, await newPassword());
  console.log(
    "Senha atualizada e verificada; sessões anteriores encerradas. Permissões preservadas.",
  );
} finally {
  if (isPostgresDatabase(db)) await db.end();
  else db.close();
}
