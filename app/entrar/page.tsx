import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/server/admin";
import { Header, Footer } from "@/components/site/navigation";
import { LoginForm } from "@/components/site/admin-auth";
export const metadata = {
  title: "Entrar",
  robots: { index: false, follow: false },
  alternates: { canonical: "/entrar" },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ voltar?: string }>;
}) {
  const requested = (await searchParams).voltar || "";
  const destination =
    /^\/(?:minha-conta(?:\/reservas)?|painel\/(?:hotel|passeios|plataforma)|hospedagens\/[a-z0-9-]+|passeios\/[a-z0-9-]+)$/.test(
      requested,
    )
      ? requested
      : "/minha-conta";
  if (await getSession()) redirect(destination);
  return (
    <>
      <Header />
      <main id="conteudo" tabIndex={-1} className="portal-main">
        <div className="auth-layout container">
          <div>
            <p className="eyebrow">BEM-VINDO À HUB</p>
            <h1>
              Sua próxima história
              <br />
              <em>começa aqui.</em>
            </h1>
            <p>Um acesso para acompanhar suas reservas e os módulos autorizados da sua equipe.</p>
          </div>
          <div className="auth-card">
            <h2>Entrar na sua conta</h2>
            <LoginForm destination={destination} />
            <p className="auth-foot">
              Ainda não possui conta? <Link href="/cadastro">Cadastre-se</Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
