import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { isAdmin } from "./authorization";
import { HttpError } from "./http";
export async function authorizeAdmin() {
  const user = await getChatGPTUser();
  if (!user) throw new HttpError(401, "UNAUTHENTICATED", "Entre com sua conta para continuar.");
  if (!isAdmin(user.email, env.ADMIN_EMAILS))
    throw new HttpError(403, "FORBIDDEN", "Esta conta não tem acesso às mensagens.");
  return user;
}
