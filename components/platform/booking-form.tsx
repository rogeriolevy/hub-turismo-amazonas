"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bookingSchema, todayInManaus } from "@/lib/platform-schema";
import { useLanguage } from "@/components/site/language-provider";
export function BookingForm({
  kind,
  options,
  authenticated,
  returnTo,
  initialStay,
}: {
  kind: "hotel" | "tour";
  options: { value: string; label: string }[];
  authenticated: boolean;
  returnTo: string;
  initialStay?: { entrada: string; saida: string; pessoas: string };
}) {
  const { t } = useLanguage();
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    key = useRef<string | null>(null);
  if (!options.length)
    return (
      <div className="portal-notice">
        {kind === "hotel" ? t("booking.noRooms") : t("booking.noDepartures")}
      </div>
    );
  if (!authenticated)
    return (
      <div className="booking-box">
        <h2>{t("booking.nextStory")}</h2>
        <p>{t("booking.signInDescription")}</p>
        <Link
          className="button button-dark"
          href={"/entrar?voltar=" + encodeURIComponent(returnTo)}
        >
          {t("booking.signInRequest")}
        </Link>
        <Link href={"/cadastro?voltar=" + encodeURIComponent(returnTo)} className="text-link">
          {t("booking.createAccount")}
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
      setError(t("booking.invalid"));
      return;
    }
    if (parsed.data.kind === "hotel") {
      const nights =
        (Date.parse(parsed.data.check_out) - Date.parse(parsed.data.check_in)) / 86400000;
      if (parsed.data.check_in < todayInManaus() || nights < 1 || nights > 30) {
        setError(t("booking.dateInvalid"));
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
        throw new Error(payload.error?.message || t("booking.sendFailed"));
      }
      router.push("/minha-conta/reservas");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error && error.name !== "TypeError" && error.name !== "TimeoutError"
          ? error.message
          : t("booking.connection"),
      );
      setBusy(false);
    }
  }
  return (
    <form className="booking-box platform-form" onSubmit={submit} aria-busy={busy}>
      <h2>{t("booking.request")}</h2>
      <p>{t("booking.approval")}</p>
      <div className="field">
        <label htmlFor="resource">
          {kind === "hotel" ? t("booking.room") : t("booking.departure")}
        </label>
        <select id="resource" name="resource" required disabled={busy}>
          <option value="">{t("booking.select")}</option>
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
            <label htmlFor="check-in">{t("booking.arrival")}</label>
            <input
              id="check-in"
              type="date"
              name="check_in"
              min={todayInManaus()}
              defaultValue={initialStay?.entrada || undefined}
              required
              disabled={busy}
            />
          </div>
          <div className="field">
            <label htmlFor="check-out">{t("booking.exit")}</label>
            <input
              id="check-out"
              type="date"
              name="check_out"
              min={todayInManaus()}
              defaultValue={initialStay?.saida || undefined}
              required
              disabled={busy}
            />
          </div>
        </div>
      )}
      <div className="field">
        <label htmlFor="guests">{t("booking.people")}</label>
        <input
          id="guests"
          name="guests"
          type="number"
          min={1}
          max={20}
          defaultValue={Number(initialStay?.pessoas) || 1}
          required
          disabled={busy}
        />
      </div>
      <div className="field">
        <label htmlFor="booking-notes">{t("booking.notes")}</label>
        <textarea id="booking-notes" name="notes" rows={3} maxLength={1000} disabled={busy} />
        <span className="field-help">{t("booking.sensitive")}</span>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button-dark" disabled={busy}>
        {busy ? t("booking.sending") : t("booking.submit")}
      </button>
    </form>
  );
}
