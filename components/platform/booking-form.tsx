"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bookingSchema, todayInManaus } from "@/lib/platform-schema";
export function BookingForm({
  kind,
  options,
  authenticated,
  returnTo,
}: {
  kind: "hotel" | "tour";
  options: { value: string; label: string }[];
  authenticated: boolean;
  returnTo: string;
}) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    key = useRef<string | null>(null);
  if (!options.length)
    return (
      <div className="portal-notice">
        {kind === "hotel"
          ? "Ainda não há quartos disponíveis para solicitar."
          : "Novas saídas serão anunciadas aqui."}
      </div>
    );
  if (!authenticated)
    return (
      <div className="booking-box">
        <h2>Planeje sua próxima história.</h2>
        <p>Entre ou crie sua conta para solicitar uma reserva e acompanhar a resposta.</p>
        <Link
          className="button button-dark"
          href={"/entrar?voltar=" + encodeURIComponent(returnTo)}
        >
          Entrar para solicitar
        </Link>
        <Link href="/cadastro" className="text-link">
          Criar uma conta
        </Link>
      </div>
    );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const input = {
      kind,
      guests: Number(data.get("guests")),
      notes: data.get("notes"),
      ...(kind === "hotel"
        ? {
            room_id: data.get("resource"),
            check_in: data.get("check_in"),
            check_out: data.get("check_out"),
          }
        : { departure_id: data.get("resource") }),
    };
    const parsed = bookingSchema.safeParse(input);
    if (!parsed.success) {
      setError("Confira o período, a quantidade de pessoas e a opção selecionada.");
      return;
    }
    if (parsed.data.kind === "hotel") {
      const nights =
        (Date.parse(parsed.data.check_out) - Date.parse(parsed.data.check_in)) / 86400000;
      if (parsed.data.check_in < todayInManaus() || nights < 1 || nights > 30) {
        setError("Escolha uma chegada a partir de hoje e uma saída de 1 a 30 noites depois.");
        return;
      }
    }
    setBusy(true);
    setError("");
    key.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/plataforma/reservas", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key.current },
        body: JSON.stringify(parsed.data),
        signal: AbortSignal.timeout(15000),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (payload.error?.code === "IDEMPOTENCY") key.current = null;
        throw new Error(payload.error?.message || "Não foi possível enviar a solicitação.");
      }
      router.push("/minha-conta/reservas");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error && error.name !== "TypeError" && error.name !== "TimeoutError"
          ? error.message
          : "Não foi possível conectar. Tente novamente.",
      );
      setBusy(false);
    }
  }
  return (
    <form className="booking-box platform-form" onSubmit={submit} aria-busy={busy}>
      <h2>Solicite sua reserva</h2>
      <p>A confirmação depende da aprovação do responsável. Não há cobrança online.</p>
      <div className="field">
        <label htmlFor="resource">
          {kind === "hotel" ? "Quarto" : "Saída (horário de Manaus)"}
        </label>
        <select id="resource" name="resource" required disabled={busy}>
          <option value="">Selecione</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {kind === "hotel" && (
        <div className="form-row">
          <div className="field">
            <label htmlFor="check-in">Chegada</label>
            <input
              id="check-in"
              type="date"
              name="check_in"
              min={todayInManaus()}
              required
              disabled={busy}
            />
          </div>
          <div className="field">
            <label htmlFor="check-out">Saída</label>
            <input
              id="check-out"
              type="date"
              name="check_out"
              min={todayInManaus()}
              required
              disabled={busy}
            />
          </div>
        </div>
      )}
      <div className="field">
        <label htmlFor="guests">Pessoas</label>
        <input
          id="guests"
          name="guests"
          type="number"
          min={1}
          max={20}
          defaultValue={1}
          required
          disabled={busy}
        />
      </div>
      <div className="field">
        <label htmlFor="booking-notes">Observações (opcional)</label>
        <textarea id="booking-notes" name="notes" rows={3} maxLength={1000} disabled={busy} />
        <span className="field-help">Não inclua documentos ou dados sensíveis.</span>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button-dark" disabled={busy}>
        {busy ? "Enviando…" : "Solicitar reserva"}
      </button>
    </form>
  );
}
