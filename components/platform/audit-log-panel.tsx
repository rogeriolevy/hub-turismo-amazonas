import Link from "next/link";
import { getLocale } from "@/lib/i18n/server";
import { translate, type MessageKey } from "@/lib/i18n/messages";
import type { AuditEntry } from "@/server/audit-service";
import { PlatformOptionSelect } from "./platform-option-select";
import { EmptyState, PageIntro } from "./shared";

type AuditPage = {
  entries: AuditEntry[];
  companyId?: string;
  page: number;
  total: number;
  totalPages: number;
};

const auditActionMessages: Record<string, MessageKey> = {
  "company.saved": "audit.action.company.saved",
  "company.publish_confirmed": "audit.action.company.publish_confirmed",
  "member.granted": "audit.action.member.granted",
  "member.revoked": "audit.action.member.revoked",
  "room.saved": "audit.action.room.saved",
  "room.status_changed": "audit.action.room.status_changed",
  "guide.saved": "audit.action.guide.saved",
  "tour.saved": "audit.action.tour.saved",
  "departure.saved": "audit.action.departure.saved",
  "booking.requested": "audit.action.booking.requested",
  "booking.confirmed": "audit.action.booking.confirmed",
  "booking.declined": "audit.action.booking.declined",
  "booking.cancelled": "audit.action.booking.cancelled",
  "stay.checkin": "audit.action.stay.checkin",
  "stay.checkout": "audit.action.stay.checkout",
  "cadastur.import": "audit.action.cadastur.import",
  "cadastur.review": "audit.action.cadastur.review",
  "catalog.created": "audit.action.catalog.created",
  "catalog.updated": "audit.action.catalog.updated",
  "catalog.deleted": "audit.action.catalog.deleted",
};

export async function AuditLogPanel({ data }: { data: AuditPage }) {
  const locale = await getLocale();
  const t = (key: MessageKey, values?: Record<string, string | number>) =>
    translate(locale, key, values);
  const dateLocale = locale === "en" ? "en-US" : locale === "es" ? "es-ES" : "pt-BR";
  const dateFormatter = new Intl.DateTimeFormat(dateLocale, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Manaus",
  });
  const pageHref = (page: number) => {
    const query = new URLSearchParams();
    if (data.companyId) query.set("empresa", data.companyId);
    query.set("page", String(page));
    return `/painel/plataforma/auditoria?${query.toString()}`;
  };

  return (
    <>
      <PageIntro
        eyebrow={t("panel.platform")}
        title={t("audit.title")}
        description={t("audit.description")}
      />
      <form className="cadastur-search audit-filter" action="/painel/plataforma/auditoria">
        <div className="field">
          <PlatformOptionSelect
            key={data.companyId ?? "all-companies"}
            id="audit-company"
            name="empresa"
            label={t("audit.company")}
            initialValue={data.companyId ?? ""}
            emptyOptionLabel={t("audit.allCompanies")}
          />
        </div>
        <div className="audit-filter-actions">
          <button className="button button-dark" type="submit">
            {t("audit.filter")}
          </button>
          {data.companyId && (
            <Link className="button button-outline" href="/painel/plataforma/auditoria">
              {t("audit.clear")}
            </Link>
          )}
        </div>
      </form>

      {data.entries.length ? (
        <>
          <div className="cadastur-table">
            <table>
              <caption>{t("audit.description")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("audit.time")}</th>
                  <th scope="col">{t("audit.actor")}</th>
                  <th scope="col">{t("audit.company")}</th>
                  <th scope="col">{t("audit.action")}</th>
                  <th scope="col">{t("audit.entity")}</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <time dateTime={entry.created_at}>
                        {dateFormatter.format(new Date(entry.created_at))}
                      </time>
                    </td>
                    <td>
                      {entry.actor_name}
                      <small>{entry.actor_email}</small>
                    </td>
                    <td>{entry.company_name ?? t("audit.platformScope")}</td>
                    <td>{t(auditActionMessages[entry.action] ?? "audit.action.unknown")}</td>
                    <td>
                      <code title={entry.entity_id}>{entry.entity_id.slice(0, 8)}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="cadastur-pagination" aria-label={t("audit.pagination")}>
            {data.page > 1 ? (
              <Link className="button button-outline" href={pageHref(data.page - 1)}>
                {t("audit.previous")}
              </Link>
            ) : (
              <span />
            )}
            <span>{t("audit.page", { page: data.page, totalPages: data.totalPages })}</span>
            {data.page < data.totalPages ? (
              <Link className="button button-outline" href={pageHref(data.page + 1)}>
                {t("audit.next")}
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </>
      ) : (
        <EmptyState title={t("audit.emptyTitle")}>
          <p>{t("audit.emptyDescription")}</p>
        </EmptyState>
      )}
    </>
  );
}
