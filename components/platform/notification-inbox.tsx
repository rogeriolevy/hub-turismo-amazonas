"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLanguage } from "@/components/site/language-provider";
import { translate, type MessageKey } from "@/lib/i18n/messages";
import type { NotificationEvent, UserNotification } from "@/server/notification-service";

const messages: Record<NotificationEvent, { title: MessageKey; body: MessageKey }> = {
  "booking.requested": {
    title: "notifications.bookingRequestedTitle",
    body: "notifications.bookingRequestedBody",
  },
  "booking.confirmed": {
    title: "notifications.bookingConfirmedTitle",
    body: "notifications.bookingConfirmedBody",
  },
  "booking.declined": {
    title: "notifications.bookingDeclinedTitle",
    body: "notifications.bookingDeclinedBody",
  },
  "booking.cancelled": {
    title: "notifications.bookingCancelledTitle",
    body: "notifications.bookingCancelledBody",
  },
  "booking.reminder": {
    title: "notifications.bookingReminderTitle",
    body: "notifications.bookingReminderBody",
  },
};

function bookingHref(notification: UserNotification) {
  if (
    notification.event === "booking.confirmed" ||
    notification.event === "booking.declined" ||
    notification.event === "booking.reminder"
  )
    return `/minha-conta/reservas?reserva=${encodeURIComponent(notification.booking_id)}`;
  const moduleName = notification.company_kind === "hotel" ? "hotel" : "passeios";
  return `/painel/${moduleName}/reservas?${new URLSearchParams({
    empresa: notification.company_id,
    reserva: notification.booking_id,
  }).toString()}`;
}

export function NotificationInbox({
  items,
  unreadCount,
}: {
  items: UserNotification[];
  unreadCount: number;
}) {
  const router = useRouter();
  const { locale } = useLanguage();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const dateLocale = locale === "en" ? "en-US" : locale === "es" ? "es-ES" : "pt-BR";
  const t = (key: MessageKey, values?: Record<string, string | number>) =>
    translate(locale, key, values);

  async function update(path: string, body: Record<string, string>, key: string) {
    if (busy) return;
    setBusy(key);
    setFailed(false);
    try {
      const response = await fetch(`/api/plataforma/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error("notification update failed");
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="notification-inbox" aria-label={t("notifications.title")}>
      <div className="notification-toolbar">
        <p>{t("notifications.unreadCount", { count: unreadCount })}</p>
        {unreadCount > 0 && (
          <button
            type="button"
            className="button button-dark"
            disabled={busy !== null}
            onClick={() => void update("notificacoes/ler-todas", {}, "all")}
          >
            {busy === "all" ? t("notifications.marking") : t("notifications.markAll")}
          </button>
        )}
      </div>
      {failed && (
        <p className="form-error" role="alert">
          {t("notifications.failed")}
        </p>
      )}
      {items.length === 0 ? (
        <p className="notification-empty">{t("notifications.empty")}</p>
      ) : (
        <div className="notification-list">
          {items.map((notification) => {
            const copy = messages[notification.event];
            const isBusy = busy === notification.id;
            return (
              <article
                className={`notification-card${notification.read_at ? "" : " unread"}`}
                key={notification.id}
              >
                <div className="notification-copy">
                  <div className="notification-heading">
                    {!notification.read_at && (
                      <span className="notification-dot" aria-hidden="true" />
                    )}
                    <h2>{t(copy.title)}</h2>
                  </div>
                  <p>{t(copy.body)}</p>
                  <p className="notification-reference">
                    {t("notifications.bookingReference", {
                      reference: notification.booking_id.slice(0, 8),
                    })}
                  </p>
                  <time dateTime={notification.created_at}>
                    {new Intl.DateTimeFormat(dateLocale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "America/Manaus",
                    }).format(new Date(notification.created_at))}
                  </time>
                </div>
                <div className="notification-actions">
                  <Link className="text-link" href={bookingHref(notification)}>
                    {t("notifications.openBooking")}
                  </Link>
                  {!notification.read_at && (
                    <button
                      type="button"
                      className="notification-read-button"
                      disabled={busy !== null}
                      onClick={() =>
                        void update(
                          "notificacoes/lida",
                          { notification_id: notification.id },
                          notification.id,
                        )
                      }
                    >
                      {isBusy ? t("notifications.marking") : t("notifications.markRead")}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
