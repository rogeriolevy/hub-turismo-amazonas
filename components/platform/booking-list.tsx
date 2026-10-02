import {
  bookingLabels,
  money,
  displayDate,
  displayTime,
  todayInManaus,
} from "@/lib/platform-schema";
import type { Booking } from "@/server/platform-models";
import { ActionForm } from "./action-form";
import { EmptyState } from "./shared";
export function BookingList({
  bookings,
  business = false,
}: {
  bookings: Booking[];
  business?: boolean;
}) {
  const today = todayInManaus();
  if (!bookings.length)
    return (
      <EmptyState title="Nenhuma solicitação por aqui.">
        <p>
          {business
            ? "As solicitações dos turistas aparecerão nesta área."
            : "Escolha uma hospedagem ou passeio para começar."}
        </p>
      </EmptyState>
    );
  return (
    <div className="booking-list">
      {bookings.map((item) => (
        <article className="reservation-card" key={item.id}>
          <div className="reservation-heading">
            <div>
              <p className="eyebrow">
                {item.kind === "hotel" ? "HOSPEDAGEM" : "PASSEIO"} · {item.id.slice(0, 8)}
              </p>
              <h2>{item.item_name}</h2>
              <p>{item.company_name}</p>
            </div>
            <span className={"status-pill " + item.status}>{bookingLabels[item.status]}</span>
          </div>
          <div className="reservation-data">
            <span>
              {item.kind === "hotel"
                ? displayDate(item.check_in!) + " → " + displayDate(item.check_out!)
                : displayTime(item.starts_at!)}
            </span>
            <span>{item.guests} pessoa(s)</span>
            <strong>
              {money(item.total_cents)} <small>valor da solicitação</small>
            </strong>
          </div>
          {business && (
            <p className="booking-person">
              {item.customer_name} · {item.customer_email}
            </p>
          )}
          {item.notes && <p className="preserve-lines">{item.notes}</p>}
          <div className="reservation-actions">
            {business
              ? item.status === "pending" && (
                  <>
                    <ActionForm
                      action="decisao"
                      fixed={{
                        company_id: item.company_id,
                        booking_id: item.id,
                        decision: "confirmed",
                      }}
                      label="Aprovar solicitação"
                    />
                    <ActionForm
                      action="decisao"
                      fixed={{
                        company_id: item.company_id,
                        booking_id: item.id,
                        decision: "declined",
                      }}
                      label="Não aprovar"
                    />
                  </>
                )
              : ["pending", "confirmed"].includes(item.status) &&
                !item.checked_in_at && (
                  <ActionForm
                    action="cancelar"
                    fixed={{ booking_id: item.id }}
                    label="Cancelar solicitação"
                  />
                )}
            {business &&
              item.kind === "hotel" &&
              item.status === "confirmed" &&
              !item.checked_in_at &&
              item.check_in &&
              item.check_out &&
              item.check_in <= today &&
              today < item.check_out && (
                <ActionForm
                  action="estadia"
                  fixed={{ company_id: item.company_id, booking_id: item.id, action: "checkin" }}
                  initial={{ country: "Brasil" }}
                  fields={[
                    { name: "country", label: "País de origem", maxLength: 80 },
                    { name: "origin_city", label: "Cidade de origem", maxLength: 100 },
                  ]}
                  label="Registrar check-in"
                />
              )}
            {business &&
              item.kind === "hotel" &&
              item.status === "confirmed" &&
              item.checked_in_at &&
              !item.checked_out_at && (
                <ActionForm
                  action="estadia"
                  fixed={{ company_id: item.company_id, booking_id: item.id, action: "checkout" }}
                  label="Registrar check-out"
                />
              )}
          </div>
        </article>
      ))}
    </div>
  );
}
