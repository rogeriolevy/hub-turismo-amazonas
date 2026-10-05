import { hashPassword, verifyPassword } from "better-auth/crypto";
import type { DatabaseExecutor } from "../db/index.ts";
import { one, run, write } from "../db/index.ts";
import { isAdmin } from "../server/authorization.ts";

// Local maintenance only. These functions are never exposed through an HTTP route.
export async function verifyStoredPassword(db: DatabaseExecutor, email: string, password: string) {
  const account = await one<{ password: string | null }>(
    db,
    "SELECT a.password FROM account a JOIN \"user\" u ON u.id = a.userId WHERE u.email = ? AND a.providerId = 'credential'",
    email.trim().toLowerCase(),
  );
  if (!account?.password || !(await verifyPassword({ hash: account.password, password })))
    throw new Error(
      "Não foi possível verificar a credencial gravada. A operação não foi validada.",
    );
}

export async function resetAdminPassword(db: DatabaseExecutor, email: string, password: string) {
  email = email.trim().toLowerCase();
  if (!isAdmin(email, process.env.ADMIN_EMAILS))
    throw new Error("Este e-mail não consta em ADMIN_EMAILS.");
  return resetLocalAccountPassword(db, email, password);
}

// Requires trusted access to the installation's terminal. Never expose as an API.
export async function resetLocalAccountPassword(
  db: DatabaseExecutor,
  email: string,
  password: string,
) {
  email = email.trim().toLowerCase();
  if (password.length < 12 || password.length > 128)
    throw new Error("Use entre 12 e 128 caracteres.");
  const user = await one<{ id: string }>(db, 'SELECT id FROM "user" WHERE email = ?', email);
  if (!user) throw new Error("Conta inexistente. A recuperação não cria novas contas.");
  const hash = await hashPassword(password);
  await write(db, async (tx) => {
    const result = await run(
      tx,
      "UPDATE account SET password = ?, updatedAt = ? WHERE userId = ? AND providerId = ?",
      hash,
      new Date().toISOString(),
      user.id,
      "credential",
    );
    if (result.changes !== 1) throw new Error("Credencial de senha não encontrada.");
    await run(tx, "DELETE FROM session WHERE userId = ?", user.id);
  });
  await verifyStoredPassword(db, email, password);
}
