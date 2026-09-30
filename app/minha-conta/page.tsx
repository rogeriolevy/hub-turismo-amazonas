import Link from "next/link";
import { Header, Footer } from "@/components/site/navigation";
import { SignOutButton } from "@/components/site/admin-auth";
import { PageIntro, ModuleSwitcher, publicModules } from "@/components/platform/shared";
import { pageActor } from "@/server/platform-session";
import { getDatabase } from "@/db";
import { companiesFor, isPlatformAdmin } from "@/server/platform-access";
import { myBookings } from "@/server/booking-service";
export const metadata = {
  title: "Minha conta",
  robots: { index: false, follow: false },
  alternates: { canonical: "/minha-conta" },
};
export default async function Page() {
  const actor = await pageActor(),
    db = getDatabase(),
    companies = companiesFor(db, actor),
    bookings = myBookings(db, actor),
    admin = isPlatformAdmin(actor);
  const modules = [...publicModules];
  if (admin || companies.some((c) => c.kind === "hotel"))
    modules.push({
      href: "/painel/hotel",
      label: "Painel hoteleiro",
      description: "Quartos, reservas e estadias.",
    });
  if (admin || companies.some((c) => c.kind === "operator"))
    modules.push({
      href: "/painel/passeios",
      label: "Painel de passeios",
      description: "Agenda, guias e vagas.",
    });
  if (admin)
    modules.push({
      href: "/painel/plataforma",
      label: "Administração geral",
      description: "Empresas e permissões.",
    });
  return (
    <>
      <Header />
      <main id="conteudo" tabIndex={-1} className="portal-main">
        <div className="container">
          <div className="portal-toolbar">
            <span>MINHA CONTA</span>
            <SignOutButton />
          </div>
          <PageIntro
            eyebrow="QUE BOM TER VOCÊ AQUI"
            title={"Olá, " + actor.name.split(" ")[0] + "."}
            description="Suas experiências e seus módulos, em um só lugar."
          />
          <div className="account-grid">
            <Link className="metric-card" href="/minha-conta/reservas">
              <span>Solicitações</span>
              <strong>{bookings.length}</strong>
              <span>Ver minhas reservas →</span>
            </Link>
            <div className="metric-card">
              <span>Aguardando resposta</span>
              <strong>{bookings.filter((b) => b.status === "pending").length}</strong>
              <span>A aprovação é feita pelo responsável.</span>
            </div>
            <div className="metric-card">
              <span>Seu cadastro</span>
              <strong className="account-name">{actor.name}</strong>
              <span>{actor.email}</span>
            </div>
          </div>
          <h2 className="subheading">Para onde vamos?</h2>
          <div className="module-cards">
            {modules
              .filter((m) => m.href !== "/minha-conta")
              .map((m) => (
                <Link href={m.href} key={m.href}>
                  <h3>{m.label}</h3>
                  <p>{m.description}</p>
                  <span>Explorar →</span>
                </Link>
              ))}
          </div>
          <div className="portal-toolbar">
            <ModuleSwitcher modules={modules} />
            <p>Os painéis são exibidos conforme os acessos concedidos à sua conta.</p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
