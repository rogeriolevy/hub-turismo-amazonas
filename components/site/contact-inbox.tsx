"use client";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox, RefreshCw } from "lucide-react";
import { useLanguage } from "@/components/site/language-provider";
type Contact = {
  id: string;
  name: string;
  email: string;
  organization: string;
  interest: string;
  message: string;
  created_at: string;
};
export function ContactInbox() {
  const { locale, t } = useLanguage();
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<{
    loading: boolean;
    error: string;
    rows: Contact[];
    total: number;
  }>({ loading: true, error: "", rows: [], total: 0 });
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/contatos?page=" + page, { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as {
          error?: { message?: string };
          data: Contact[];
          total: number;
        };
        if (!response.ok) throw new Error(t("admin.loadError"));
        return data;
      })
      .then((data) => setState({ loading: false, error: "", rows: data.data, total: data.total }))
      .catch((error) => {
        if (error.name !== "AbortError")
          setState({ loading: false, error: error.message, rows: [], total: 0 });
      });
    return () => controller.abort();
  }, [page, refresh, t]);
  function reload(next = page) {
    if (state.loading || next < 1 || (next !== page && next > Math.ceil(state.total / 20))) return;
    setState((prev) => ({ ...prev, loading: true, error: "" }));
    setPage(next);
    setRefresh((value) => value + 1);
  }
  return (
    <section aria-label={t("admin.inbox")} aria-busy={state.loading}>
      <div className="inbox-heading">
        <p role="status">{t("admin.contactCount", { count: state.total })}</p>
        <button className="text-link" onClick={() => reload()} aria-disabled={state.loading}>
          <RefreshCw size={16} />
          {t("admin.refresh")}
        </button>
      </div>
      {state.loading ? (
        <div aria-label={t("admin.loadingContacts")} role="status" className="inbox-loading">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <span>{t("admin.loadingMessages")}</span>
        </div>
      ) : state.error ? (
        <div className="admin-notice" role="alert">
          <p>{state.error}</p>
          <p>{t("admin.retryRefresh")}</p>
        </div>
      ) : state.rows.length === 0 ? (
        <div className="admin-notice empty-inbox">
          <Inbox size={40} />
          <h2>{t("admin.noMessages")}</h2>
          <p>{t("admin.messagesAppear")}</p>
        </div>
      ) : (
        <div className="inbox-list">
          {state.rows.map((contact) => (
            <article key={contact.id}>
              <div className="inbox-heading">
                <h2>{contact.name}</h2>
                <time dateTime={contact.created_at}>
                  {new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : locale, {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: "America/Manaus",
                  }).format(new Date(contact.created_at))}
                </time>
              </div>
              <p>
                <a href={"mailto:" + contact.email}>{contact.email}</a>
                {contact.organization ? " · " + contact.organization : ""}
              </p>
              <span className="stage-label">{contact.interest}</span>
              <p className="contact-message">{contact.message}</p>
            </article>
          ))}
        </div>
      )}
      <nav className="pagination" aria-label={t("admin.contactPages")}>
        <button
          className="button button-dark"
          aria-disabled={state.loading || page === 1}
          onClick={() => reload(page - 1)}
        >
          {t("admin.previous")}
        </button>
        <span>
          {locale === "es" ? "Página" : locale === "en" ? "Page" : "Página"} {page}{" "}
          {locale === "en" ? "of" : "de"} {Math.max(1, Math.ceil(state.total / 20))}
        </span>
        <button
          className="button button-dark"
          aria-disabled={state.loading || page * 20 >= state.total}
          onClick={() => reload(page + 1)}
        >
          {t("admin.next")}
        </button>
      </nav>
    </section>
  );
}
