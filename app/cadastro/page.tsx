import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/server/admin";
import { Header, Footer } from "@/components/site/navigation";
import { RegistrationForm } from "@/components/platform/registration-form";
export const metadata = {
  title: "Criar conta",
  robots: { index: false, follow: false },
  alternates: { canonical: "/cadastro" },
};
export default async function Page() {
  if (await getSession()) redirect("/minha-conta");
  return (
    <>
      <Header />
      <main id="conteudo" tabIndex={-1} className="portal-main">
        <div className="auth-layout container">
          <div>
            <p className="eyebrow">FAÇA PARTE</p>
            <h1>
              Mais perto
              <br />
              da <em>Amazônia.</em>
            </h1>
            <p>
              Crie sua conta para solicitar hospedagens e passeios. Você acompanha cada resposta em
              um só lugar.
            </p>
          </div>
          <div className="auth-card">
            <h2>Criar minha conta</h2>
            <RegistrationForm />
            <p className="auth-foot">
              Já possui conta? <Link href="/entrar">Entrar</Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
