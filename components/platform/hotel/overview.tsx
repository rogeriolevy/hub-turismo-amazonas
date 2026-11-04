import Link from "next/link";
import { BedDouble, CalendarCheck2, UsersRound, Wrench } from "lucide-react";
import { companyDisplayName } from "@/lib/platform-schema/company";
import type { Booking, Company, OperationalRoom } from "@/server/platform-models";
import type { BusinessBookingSummary } from "@/server/booking-service";
import type { CompanyRoomSummary, InventoryPage } from "@/server/inventory-read-service";
import { BookingList } from "../booking-list";
import { PaginationNavigation } from "../pagination-navigation";
import { PageIntro } from "../shared";
import { HotelOperationSummary, RoomStatusBoard } from "../room-status-board";

export function HotelOverview({
  company,
  companyId,
  bookingSummary,
  roomSummary,
  rooms,
  roomsPage,
  attentionBookings,
}: {
  company: Company;
  companyId: string;
  bookingSummary: BusinessBookingSummary;
  roomSummary: CompanyRoomSummary;
  rooms: OperationalRoom[];
  roomsPage?: InventoryPage<OperationalRoom>;
  attentionBookings: Booking[];
}) {
  const roomsToPrepare = roomSummary.roomsToPrepare;

  return (
    <>
      <PageIntro
        eyebrow="OPERAÇÃO HOTELEIRA"
        title={companyDisplayName(company)}
        description={`${company.city} · ${company.status === "published" ? "Publicado no catálogo" : "Fora do catálogo público"}`}
      />
      <HotelOperationSummary
        arrivals={bookingSummary.arrivals}
        departures={bookingSummary.departures}
        pendingBookings={bookingSummary.pending}
        roomsToPrepare={roomsToPrepare}
      />
      <div className="hotel-operations-metrics" aria-label="Resumo de quartos e reservas">
        <Link
          className="hotel-operations-metric"
          href={`/painel/hotel/quartos?empresa=${companyId}`}
        >
          <span className="hotel-operations-metric-icon">
            <BedDouble size={18} aria-hidden="true" />
          </span>
          <span>Quartos prontos</span>
          <strong>{roomSummary.ready}</strong>
          <span>Conferir acomodações →</span>
        </Link>
        <Link className="hotel-operations-metric" href={`/painel/hotel/fnrh?empresa=${companyId}`}>
          <span className="hotel-operations-metric-icon">
            <UsersRound size={18} aria-hidden="true" />
          </span>
          <span>Hóspedes hospedados</span>
          <strong>{roomSummary.occupied}</strong>
          <span>Estadias com check-in →</span>
        </Link>
        <Link
          className="hotel-operations-metric"
          href={`/painel/hotel/quartos?empresa=${companyId}`}
        >
          <span className="hotel-operations-metric-icon">
            <Wrench size={18} aria-hidden="true" />
          </span>
          <span>Limpeza ou manutenção</span>
          <strong>{roomsToPrepare}</strong>
          <span>Atualizar situação →</span>
        </Link>
        <Link
          className="hotel-operations-metric"
          href={`/painel/hotel/reservas?empresa=${companyId}`}
        >
          <span className="hotel-operations-metric-icon">
            <CalendarCheck2 size={18} aria-hidden="true" />
          </span>
          <span>Solicitações pendentes</span>
          <strong>{bookingSummary.pending}</strong>
          <span>Aguardando análise →</span>
        </Link>
      </div>
      <RoomStatusBoard companyId={companyId} rooms={rooms} />
      {roomsPage && (
        <PaginationNavigation
          page={roomsPage.page}
          totalPages={roomsPage.totalPages}
          hrefForPage={(page) =>
            `/painel/hotel?${new URLSearchParams({ empresa: companyId, roomPage: String(page) }).toString()}`
          }
        />
      )}
      <h2 className="subheading">Precisam da sua atenção</h2>
      <BookingList bookings={attentionBookings} business />
    </>
  );
}
