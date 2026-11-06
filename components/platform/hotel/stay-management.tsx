import { ActionForm } from "../action-form";
import { EmptyState, PageIntro, PortalNotice } from "../shared";
import { PaginationNavigation } from "../pagination-navigation";
import { displayDate, displayTime, todayInManaus } from "@/lib/platform-schema/format";
import type { BookingPage } from "@/server/booking-service";

export function StayManagement({
  companyId,
  companyName,
  stayPage,
}: {
  companyId: string;
  companyName: string;
  stayPage: BookingPage;
}) {
  const today = todayInManaus();

  return (
    <>
      <PageIntro
        eyebrow={companyName}
        title="FNRH · Registro de estadias"
        description="Organize chegadas e saídas vinculadas às reservas confirmadas. O registro também pode ser iniciado na lista de reservas."
      />
      <PortalNotice>
        Registro local de estadia. Esta versão não preenche nem transmite a FNRH oficial e não
        substitui o procedimento governamental. A integração oficial será uma etapa própria.
      </PortalNotice>
      {!stayPage.total ? (
        <EmptyState title="Nenhuma estadia confirmada.">
          <p>Aprove uma solicitação em Reservas para registrar a chegada.</p>
        </EmptyState>
      ) : (
        <div className="editor-list">
          {stayPage.items.map((booking) => (
            <article className="reservation-card" key={booking.id}>
              <h2>{booking.customer_name}</h2>
              <p>
                {booking.item_name} · {displayDate(booking.check_in!)} →{" "}
                {displayDate(booking.check_out!)}
              </p>
              {booking.checked_in_at ? (
                <>
                  <p>
                    Entrada: {displayTime(booking.checked_in_at)} · Origem: {booking.origin_city},{" "}
                    {booking.country}
                  </p>
                  {booking.checked_out_at ? (
                    <p>Saída: {displayTime(booking.checked_out_at)}</p>
                  ) : (
                    <ActionForm
                      action="estadia"
                      fixed={{ company_id: companyId, booking_id: booking.id, action: "checkout" }}
                      label="Registrar check-out"
                    />
                  )}
                </>
              ) : booking.check_in! <= today && today < booking.check_out! ? (
                <ActionForm
                  action="estadia"
                  fixed={{ company_id: companyId, booking_id: booking.id, action: "checkin" }}
                  initial={{ country: "Brasil" }}
                  fields={[
                    { name: "country", label: "País de origem", maxLength: 80 },
                    { name: "origin_city", label: "Cidade de origem", maxLength: 100 },
                  ]}
                  label="Registrar check-in"
                />
              ) : (
                <p>
                  O check-in poderá ser registrado entre {displayDate(booking.check_in!)} e{" "}
                  {displayDate(booking.check_out!)}.
                </p>
              )}
            </article>
          ))}
        </div>
      )}
      <PaginationNavigation
        page={stayPage.page}
        totalPages={stayPage.totalPages}
        hrefForPage={(page) =>
          `/painel/hotel/fnrh?${new URLSearchParams({ empresa: companyId, page: String(page) }).toString()}`
        }
      />
    </>
  );
}
