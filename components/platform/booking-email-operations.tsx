import { translate, type Locale, type MessageKey } from "@/lib/i18n/messages";
import type { BookingEmailOperationsSummary } from "@/server/booking-email-operations-service";
import type { BookingEmailEvent } from "@/server/booking-email";
import { BookingEmailOperationsRefresh } from "./booking-email-operations-refresh";
import { EmptyState } from "./shared";
import styles from "./booking-email-operations.module.css";

const eventLabels: Record<BookingEmailEvent, MessageKey> = {
  "booking.requested": "emailOps.eventRequested",
  "booking.confirmed": "emailOps.eventConfirmed",
  "booking.declined": "emailOps.eventDeclined",
  "booking.cancelled": "emailOps.eventCancelled",
};

export async function BookingEmailOperations({
  data,
  locale,
}: {
  data: BookingEmailOperationsSummary;
  locale: Locale;
}) {
  const t = (key: MessageKey, values?: Record<string, string | number>) =>
    translate(locale, key, values);
  const dateLocale = locale === "en" ? "en-US" : locale === "es" ? "es-ES" : "pt-BR";
  const dateFormatter = new Intl.DateTimeFormat(dateLocale, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Manaus",
  });

  return (
    <>
      <BookingEmailOperationsRefresh />
      <header className="portal-intro">
        <p className="eyebrow">{t("panel.platform")}</p>
        <h1>{t("emailOps.title")}</h1>
        <p>{t("emailOps.description")}</p>
      </header>

      <p className={styles.channelState} role="status">
        {t(data.enabled ? "emailOps.enabled" : "emailOps.disabled")}
      </p>
      <section aria-labelledby="booking-email-worker-title">
        <h2 id="booking-email-worker-title" className={styles.sectionHeading}>
          {t("emailOps.workerTitle")}
        </h2>
        <p className={styles.channelState} role="status">
          {t(`emailOps.workerState.${data.worker.state}` as MessageKey)}
        </p>
        {data.worker.lastSeenAt && data.worker.ageSeconds !== null ? (
          <p className={styles.operationalNote}>
            {t("emailOps.workerLastSeen", {
              time: dateFormatter.format(new Date(data.worker.lastSeenAt)),
              seconds: data.worker.ageSeconds,
            })}
          </p>
        ) : null}
      </section>
      <p className={styles.operationalNote}>{t("emailOps.healthNote")}</p>
      <p className={styles.operationalNote}>{t("emailOps.autoRefresh")}</p>

      <section aria-labelledby="booking-email-queue-title">
        <h2 id="booking-email-queue-title" className={styles.sectionHeading}>
          {t("emailOps.queueTitle")}
        </h2>
        <dl className={styles.statusGrid}>
          {data.statuses.map(({ status, count }) => (
            <div className={styles.statusCard} key={status}>
              <dt>{t(`emailOps.status.${status}` as MessageKey)}</dt>
              <dd>{count.toLocaleString(dateLocale)}</dd>
            </div>
          ))}
        </dl>
        <p className={styles.operationalNote}>{t("emailOps.total", { count: data.total })}</p>
      </section>

      <section aria-labelledby="booking-email-failures-title">
        <h2 id="booking-email-failures-title" className={styles.sectionHeading}>
          {t("emailOps.failuresTitle")}
        </h2>
        {data.failures.length ? (
          <div className="cadastur-table">
            <table>
              <caption>{t("emailOps.failuresDescription")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("emailOps.time")}</th>
                  <th scope="col">{t("emailOps.reference")}</th>
                  <th scope="col">{t("emailOps.event")}</th>
                  <th scope="col">{t("emailOps.attempts")}</th>
                  <th scope="col">{t("emailOps.recipients")}</th>
                  <th scope="col">{t("emailOps.errorCode")}</th>
                </tr>
              </thead>
              <tbody>
                {data.failures.map((failure) => (
                  <tr
                    key={`${failure.bookingId}-${failure.event}-${failure.lastErrorCode ?? "none"}`}
                  >
                    <td>
                      <time dateTime={failure.updatedAt}>
                        {dateFormatter.format(new Date(failure.updatedAt))}
                      </time>
                    </td>
                    <td>
                      <code>{failure.bookingReference}</code>
                    </td>
                    <td>{t(eventLabels[failure.event])}</td>
                    <td>{failure.attempts}</td>
                    <td>{failure.recipientCount}</td>
                    <td>
                      <code>{failure.lastErrorCode ?? "—"}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={t("emailOps.emptyTitle")}>
            <p>{t("emailOps.emptyDescription")}</p>
          </EmptyState>
        )}
      </section>
    </>
  );
}
