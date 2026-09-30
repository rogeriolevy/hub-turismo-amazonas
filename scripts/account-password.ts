import { openDatabase } from "../db/index.ts";
import { newPassword } from "./password-prompt.ts";
import { resetLocalAccountPassword } from "./admin-credentials.ts";

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email || !email.includes("@"))
  throw new Error("Informe o e-mail: npm run account:password -- EMAIL");
const db = openDatabase();
try {
  if (!db.prepare('SELECT id FROM "user" WHERE email = ?').get(email))
    throw new Error("Conta inexistente. A recuperação não cria novas contas.");
  console.log(
    `Manutenção local da conta ${email}. Confirme a identidade da pessoa antes de redefinir.`,
  );
  await resetLocalAccountPassword(db, email, await newPassword());
  console.log(
    "Senha atualizada e verificada; sessões anteriores encerradas. Permissões preservadas.",
  );
} finally {
  db.close();
}
