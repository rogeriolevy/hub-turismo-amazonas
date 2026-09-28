"use client";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox, RefreshCw } from "lucide-react";
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
        if (!response.ok) throw new Error(data.error?.message || "Não foi possível carregar.");
        return data;
      })
      .then((data) => setState({ loading: false, error: "", rows: data.data, total: data.total }))
      .catch((error) => {
        if (error.name !== "AbortError")
          setState({ loading: false, error: error.message, rows: [], total: 0 });
      });
    return () => controller.abort();
  }, [page, refresh]);
  function reload(next = page) {
    setState((prev) => ({ ...prev, loading: true, error: "" }));
    setPage(next);
    setRefresh((value) => value + 1);
  }
  if (state.loading)
    return (
      <div aria-label="Carregando contatos" role="status" className="inbox-loading">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <span>Carregando mensagens…</span>
      </div>
    );
  if (state.error)
    return (
      <div className="admin-notice" role="alert">
        <p>{state.error}</p>
        <button className="button button-dark" onClick={() => reload()}>
          Tentar novamente
        </button>
      </div>
    );
  return (
    <>
      <div className="inbox-heading">
        <p>{state.total} contato(s) recebido(s)</p>
        <button className="text-link" onClick={() => reload()}>
          <RefreshCw size={16} />
          Atualizar
        </button>
      </div>
      {state.rows.length === 0 ? (
        <div className="admin-notice empty-inbox">
          <Inbox size={40} />
          <h2>Nenhuma mensagem por aqui</h2>
          <p>Os contatos enviados pelo site aparecerão nesta área.</p>
        </div>
      ) : (
        <div className="inbox-list">
          {state.rows.map((contact) => (
            <article key={contact.id}>
              <div className="inbox-heading">
                <h2>{contact.name}</h2>
                <time dateTime={contact.created_at}>
                  {new Intl.DateTimeFormat("pt-BR", {
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
      <nav className="pagination" aria-label="Páginas de contatos">
        <button
          className="button button-dark"
          disabled={page === 1}
          onClick={() => reload(page - 1)}
        >
          Anterior
        </button>
        <span>
          Página {page} de {Math.max(1, Math.ceil(state.total / 20))}
        </span>
        <button
          className="button button-dark"
          disabled={page * 20 >= state.total}
          onClick={() => reload(page + 1)}
        >
          Próxima
        </button>
      </nav>
    </>
  );
}
