import { BookingList } from "./booking-list";
import { PageIntro } from "./shared";
import { PaginationNavigation } from "./pagination-navigation";
import { displayTime } from "@/lib/platform-schema/format";
import type { BookingPage } from "@/server/booking-service";
import type { InventoryPage } from "@/server/inventory-read-service";
import type { Departure } from "@/server/platform-models";

type BusinessArea = "hotel" | "passeios";
type BusinessSection = "reservas" | "vagas";

export function BookingManagement({
  area,
  section,
  companyName,
  bookingPage,
  bookingHrefForPage,
  departuresPage,
  departureHrefForPage,
}: {
  area: BusinessArea;
  section: BusinessSection;
  companyName: string;
  bookingPage: BookingPage;
  bookingHrefForPage: (page: number) => string;
  departuresPage?: InventoryPage<Departure & { tour_name: string }>;
  departureHrefForPage?: (page: number) => string;
}) {
  const isHotel = area === "hotel";

  return (
    <>
      <PageIntro
        eyebrow={companyName}
        title={isHotel ? "Reservas" : "Vagas e solicitações"}
        description={
          isHotel
            ? "Aprove solicitações e registre check-in e check-out diretamente na reserva, conforme o período da estadia."
            : "Analise os pedidos. A disponibilidade é conferida novamente no momento da aprovação."
        }
      />
      {section === "vagas" && departuresPage && (
        <>
          <div className="resource-list">
            {departuresPage.items.map((departure) => (
              <article key={departure.id}>
                <div>
                  <h3>{departure.tour_name}</h3>
                  <p>{displayTime(departure.starts_at)}</p>
                </div>
                <strong>
                  {departure.capacity - (departure.reserved || 0)} de {departure.capacity} vagas
                  livres
                </strong>
              </article>
            ))}
          </div>
          {departureHrefForPage && (
            <PaginationNavigation
              page={departuresPage.page}
              totalPages={departuresPage.totalPages}
              hrefForPage={departureHrefForPage}
            />
          )}
        </>
      )}
      <BookingList
        bookings={bookingPage.items}
        business
        historyByBookingId={bookingPage.historyByBookingId}
        pagination={{
          page: bookingPage.page,
          totalPages: bookingPage.totalPages,
          hrefForPage: bookingHrefForPage,
        }}
      />
    </>
  );
}
