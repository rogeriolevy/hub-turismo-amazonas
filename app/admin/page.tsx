import type { Metadata } from "next";
import Link from "next/link";
import { Header, Footer } from "@/components/site/navigation";
import { getSession } from "@/server/admin";
import { LoginForm, SignOutButton } from "@/components/site/admin-auth";
import { isAdmin } from "@/server/authorization";
import { ContactInbox } from "@/components/site/contact-inbox";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Contatos recebidos",
  robots: { index: false, follow: false },
  alternates: { canonical: "/admin" },
};
export default async function Admin() {
  const session = await getSession();
  const user = session?.user;
  return (
    <>
      <Header />
      <main id="conteudo" tabIndex={-1} className="container admin-main">
        <p className="eyebrow">ÁREA RESTRITA</p>
        <h1>Contatos recebidos</h1>
        {!user ? (
          <div className="admin-notice">
            <p>Entre com uma conta autorizada da equipe para consultar as mensagens.</p>
            <LoginForm />
          </div>
        ) : !isAdmin(user.email, process.env.ADMIN_EMAILS) ? (
          <div className="admin-notice">
            <h2>Acesso não autorizado</h2>
            <p>
              Esta conta ainda não está habilitada para consultar mensagens. Solicite acesso ao
              responsável pelo site.
            </p>
            <SignOutButton />
          </div>
        ) : (
          <>
            <div className="inbox-heading">
              <p>Acesso de {user.email}</p>
              <Link className="text-link" href="/painel/plataforma">
                Administração da plataforma
              </Link>
              <SignOutButton />
            </div>
            <ContactInbox />
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
