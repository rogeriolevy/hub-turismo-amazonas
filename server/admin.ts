import { headers } from "next/headers";
import { getAuth } from "./auth";
import { isAdmin } from "./authorization";
import { HttpError } from "./http";
export async function getSession() {
  return getAuth().api.getSession({ headers: await headers() });
}
export async function authorizeAdmin() {
  const session = await getSession();
  if (!session) throw new HttpError(401, "UNAUTHENTICATED", "Entre com sua conta para continuar.");
  if (!isAdmin(session.user.email, process.env.ADMIN_EMAILS))
    throw new HttpError(403, "FORBIDDEN", "Esta conta não tem acesso às mensagens.");
  return session.user;
}
