import Link from "next/link";
import { Header, Footer } from "@/components/site/navigation";
import { PageIntro } from "@/components/platform/shared";
import { BookingList } from "@/components/platform/booking-list";
import { pageActor } from "@/server/platform-session";
import { getDatabase } from "@/db";
import { myBookingsPage } from "@/server/booking-read-service";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Minhas reservas",
  robots: { index: false, follow: false },
  alternates: { canonical: "/minha-conta/reservas" },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; reserva?: string }>;
}) {
  const query = await searchParams;
  const actor = await pageActor("/minha-conta/reservas");
  const bookingId = typeof query.reserva === "string" ? query.reserva : undefined;
  const bookings = await myBookingsPage(getDatabase(), actor, query.page, true, bookingId);
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
          <BookingList
            bookings={bookings.items}
            historyByBookingId={bookings.historyByBookingId}
            pagination={{
              page: bookings.page,
              totalPages: bookings.totalPages,
              hrefForPage: (page) => `/minha-conta/reservas?page=${page}`,
            }}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
