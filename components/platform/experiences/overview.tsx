import { companyDisplayName } from "@/lib/platform-schema/company";
import type { Booking, Company } from "@/server/platform-models";
import type { BusinessBookingSummary } from "@/server/booking-service";
import type { CompanyOperatorSummary } from "@/server/inventory-read-service";
import { BookingList } from "../booking-list";
import { PageIntro } from "../shared";

export function ExperiencesOverview({
  company,
  operatorSummary,
  bookingSummary,
  attentionBookings,
}: {
  company: Company;
  operatorSummary: CompanyOperatorSummary;
  bookingSummary: BusinessBookingSummary;
  attentionBookings: Booking[];
}) {
  return (
    <>
      <PageIntro
        eyebrow="OPERAÇÃO DE EXPERIÊNCIAS"
        title={companyDisplayName(company)}
        description={`${company.city} · ${company.status === "published" ? "Publicado no catálogo" : "Fora do catálogo público"}`}
      />
      <div className="account-grid">
        <div className="metric-card">
          <span>Passeios e roteiros</span>
          <strong>{operatorSummary.tours}</strong>
          <span>Experiências publicáveis</span>
        </div>
        <div className="metric-card">
          <span>Guias cadastrados</span>
          <strong>{operatorSummary.guides}</strong>
          <span>Profissionais da equipe</span>
        </div>
        <div className="metric-card">
          <span>Solicitações pendentes</span>
          <strong>{bookingSummary.pending}</strong>
          <span>Aguardando a sua análise</span>
        </div>
        <div className="metric-card">
          <span>Reservas confirmadas</span>
          <strong>{bookingSummary.confirmed}</strong>
          <span>Todos os períodos</span>
        </div>
      </div>
      <h2 className="subheading">Precisam da sua atenção</h2>
      <BookingList bookings={attentionBookings} business />
    </>
  );
}
