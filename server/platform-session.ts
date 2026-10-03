import { redirect } from "next/navigation";
import { getSession } from "./admin";
import { HttpError } from "./http";
import { jwtUserFromRequest } from "./jwt-identity";

export async function requireActor(request?: Request) {
  const jwtUser = request ? await jwtUserFromRequest(request) : null;
  const session = jwtUser ? null : await getSession();
  const user = jwtUser ?? session?.user;
  if (!user) throw new HttpError(401, "UNAUTHENTICATED", "Entre com sua conta para continuar.");
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
  };
}
export async function pageActor(returnTo = "/minha-conta") {
  const session = await getSession();
  if (!session) redirect("/entrar?voltar=" + encodeURIComponent(returnTo));
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
  };
}
