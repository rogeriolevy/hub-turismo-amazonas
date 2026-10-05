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
import { getLocale } from "@/lib/i18n/server";
import { translate, type MessageKey } from "@/lib/i18n/messages";
export async function BookingList({
  bookings,
  business = false,
}: {
  bookings: Booking[];
  business?: boolean;
}) {
  const locale = await getLocale();
  const t = (key: MessageKey) => translate(locale, key);
  const today = todayInManaus();
  if (!bookings.length)
    return (
      <EmptyState title={t("booking.noRequestsTitle")}>
        <p>{business ? t("booking.businessEmpty") : t("booking.customerEmpty")}</p>
      </EmptyState>
    );
  return (
    <div className="booking-list">
      {bookings.map((item) => (
        <article className="reservation-card" key={item.id}>
          <div className="reservation-heading">
            <div>
              <p className="eyebrow">
                {item.kind === "hotel" ? t("booking.stayTag") : t("booking.tourTag")} ·{" "}
                {item.id.slice(0, 8)}
              </p>
              <h2>{item.item_name}</h2>
              <p>{item.company_name}</p>
            </div>
            <span className={"status-pill " + item.status}>
              {t(`bookingLabels.${item.status}` as MessageKey) || bookingLabels[item.status]}
            </span>
          </div>
          <div className="reservation-data">
            <span>
              {item.kind === "hotel"
                ? displayDate(item.check_in!) + " → " + displayDate(item.check_out!)
                : displayTime(item.starts_at!)}
            </span>
            <span>
              {item.guests} {t(item.guests === 1 ? "booking.onePerson" : "booking.manyPeople")}
            </span>
            <strong>
              {money(item.total_cents)} <small>{t("booking.requestAmount")}</small>
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
                      label={t("booking.approve")}
                    />
                    <ActionForm
                      action="decisao"
                      fixed={{
                        company_id: item.company_id,
                        booking_id: item.id,
                        decision: "declined",
                      }}
                      label={t("booking.decline")}
                    />
                  </>
                )
              : ["pending", "confirmed"].includes(item.status) &&
                !item.checked_in_at && (
                  <ActionForm
                    action="cancelar"
                    fixed={{ booking_id: item.id }}
                    label={t("booking.cancel")}
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
                    { name: "country", label: t("booking.originCountry"), maxLength: 80 },
                    { name: "origin_city", label: t("booking.originCity"), maxLength: 100 },
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
