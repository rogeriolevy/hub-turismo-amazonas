import { headers } from "next/headers";
import { getAuth } from "./auth";
import { isAdmin } from "./authorization";
import { HttpError } from "./http";
import { jwtUserFromRequest } from "./jwt-identity";
export async function getSession() {
  return getAuth().api.getSession({ headers: await headers() });
}
export async function authorizeAdmin(request?: Request) {
  const jwtUser = request ? await jwtUserFromRequest(request) : null;
  const session = jwtUser ? null : await getSession();
  const user = jwtUser ?? session?.user;
  if (!user) throw new HttpError(401, "UNAUTHENTICATED", "Entre com sua conta para continuar.");
  if (!isAdmin(user.email, process.env.ADMIN_EMAILS))
    throw new HttpError(403, "FORBIDDEN", "Esta conta não tem acesso às mensagens.");
  return user;
}
