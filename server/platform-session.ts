import { redirect } from "next/navigation";
import { getSession } from "./admin";
import { HttpError } from "./http";
export async function requireActor() {
  const session = await getSession();
  if (!session) throw new HttpError(401, "UNAUTHENTICATED", "Entre com sua conta para continuar.");
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
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
