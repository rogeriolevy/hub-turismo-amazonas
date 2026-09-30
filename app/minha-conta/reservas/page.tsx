import Link from "next/link";
import { Header, Footer } from "@/components/site/navigation";
import { PageIntro } from "@/components/platform/shared";
import { BookingList } from "@/components/platform/booking-list";
import { pageActor } from "@/server/platform-session";
import { getDatabase } from "@/db";
import { myBookings } from "@/server/booking-service";
export const metadata = {
  title: "Minhas reservas",
  robots: { index: false, follow: false },
  alternates: { canonical: "/minha-conta/reservas" },
};
export default async function Page() {
  const actor = await pageActor("/minha-conta/reservas");
  return (
    <>
      <Header />
      <main id="conteudo" tabIndex={-1} className="portal-main">
        <div className="container">
          <Link href="/minha-conta" className="text-link">
            ← Minha conta
          </Link>
          <PageIntro
            eyebrow="SUAS EXPERIÊNCIAS"
            title="Minhas reservas"
            description="Acompanhe a resposta da equipe. Não há pagamento online nesta versão."
          />
          <BookingList bookings={myBookings(getDatabase(), actor)} />
        </div>
      </main>
      <Footer />
    </>
  );
}
