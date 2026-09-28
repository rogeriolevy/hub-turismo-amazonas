import type { Metadata } from "next";
import { Header, Footer } from "@/components/site/navigation";
import { getChatGPTUser, chatGPTSignInPath, chatGPTSignOutPath } from "@/app/chatgpt-auth";
import { env } from "cloudflare:workers";
import { isAdmin } from "@/server/authorization";
import { ContactInbox } from "@/components/site/contact-inbox";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Contatos recebidos",
  robots: { index: false, follow: false },
  alternates: { canonical: "/admin" },
};
export default async function Admin() {
  const user = await getChatGPTUser();
  return (
    <>
      <Header />
      <main id="conteudo" className="container admin-main">
        <p className="eyebrow">ÁREA RESTRITA</p>
        <h1>Contatos recebidos</h1>
        {!user ? (
          <div className="admin-notice">
            <p>Entre com uma conta autorizada da equipe para consultar as mensagens.</p>
            <a className="button button-dark" href={chatGPTSignInPath("/admin")} target="_top">
              Entrar com ChatGPT
            </a>
          </div>
        ) : !isAdmin(user.email, env.ADMIN_EMAILS) ? (
          <div className="admin-notice">
            <h2>Acesso não autorizado</h2>
            <p>
              Esta conta ainda não está habilitada para consultar mensagens. Solicite acesso ao
              responsável pelo site.
            </p>
            <a className="text-link" href={chatGPTSignOutPath("/admin")} target="_top">
              Sair e trocar de conta
            </a>
          </div>
        ) : (
          <>
            <div className="inbox-heading">
              <p>Acesso de {user.email}</p>
              <a className="text-link" href={chatGPTSignOutPath("/")} target="_top">
                Sair
              </a>
            </div>
            <ContactInbox />
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
