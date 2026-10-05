"use client";
import { useState, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  companySchema,
  memberSchema,
  roomSchema,
  roomOperationalStatusSchema,
  guideSchema,
  tourSchema,
  departureSchema,
  decisionSchema,
  staySchema,
} from "@/lib/platform-schema";
import { useLanguage } from "@/components/site/language-provider";
import { translateText } from "@/lib/i18n/messages";
export type Field = {
  name: string;
  label: string;
  type?:
    | "text"
    | "email"
    | "textarea"
    | "number"
    | "currency"
    | "checkbox"
    | "select"
    | "datetime-local";
  required?: boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  maxLength?: number;
  hint?: string;
  kindFromValue?: Record<string, "hotel" | "operator">;
};
type Values = Record<string, string | number | boolean | null>;
const schemas = {
  empresas: companySchema,
  acessos: memberSchema,
  quartos: roomSchema,
  "quarto-status": roomOperationalStatusSchema,
  guias: guideSchema,
  passeios: tourSchema,
  saidas: departureSchema,
  decisao: decisionSchema,
  estadia: staySchema,
};
export function ActionForm({
  action,
  fields = [],
  fixed = {},
  initial = {},
  label = "Salvar",
  reset = false,
}: {
  action: string;
  fields?: Field[];
  fixed?: Values;
  initial?: Values;
  label?: string;
  reset?: boolean;
}) {
  const { locale } = useLanguage();
  const localize = (value: string) => translateText(locale, value);
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState(""),
    [success, setSuccess] = useState(false),
    formRef = useRef<HTMLFormElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget),
      body: Values = { ...fixed };
    for (const field of fields) {
      const value = String(form.get(field.name) ?? "");
      if (field.kindFromValue && value in field.kindFromValue)
        body.kind = field.kindFromValue[value];
      if (field.type === "datetime-local" && value && Number.isNaN(Date.parse(value + "-04:00"))) {
        setSuccess(false);
        setFeedback(`${field.label}: informe uma data e um horário válidos.`);
        return;
      }
      body[field.name] =
        field.type === "checkbox"
          ? form.has(field.name)
          : field.type === "number"
            ? Number(value)
            : field.type === "currency"
              ? Math.round(Number(value) * 100)
              : field.type === "datetime-local" && value
                ? new Date(value + "-04:00").toISOString()
                : value;
    }
    const schema = schemas[action as keyof typeof schemas];
    const validation = schema?.safeParse(body);
    if (validation && !validation.success) {
      setSuccess(false);
      setFeedback(
        validation.error.issues
          .map(
            (item) =>
              `${fields.find((f) => f.name === item.path[0])?.label || "Campo"}: ${item.message}`,
          )
          .join(" "),
      );
      return;
    }
    setBusy(true);
    setFeedback("");
    setSuccess(false);
    try {
      const response = await fetch("/api/plataforma/" + action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível salvar.");
      setSuccess(true);
      setFeedback(localize("Alteração salva."));
      if (reset) formRef.current?.reset();
      router.refresh();
    } catch (error) {
      setFeedback(
        error instanceof Error && error.name !== "TypeError" && error.name !== "TimeoutError"
          ? error.message
          : localize("Não foi possível conectar. Confira a conexão e tente novamente."),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      ref={formRef}
      className={fields.length ? "platform-form" : "inline-action"}
      aria-busy={busy}
    >
      {fields.map((field) => {
        const fieldId = `${action}-${String(fixed.id || fixed.company_id || fixed.booking_id || "new")}-${field.name}`;
        let value = initial[field.name];
        if (field.type === "currency" && typeof value === "number") value = value / 100;
        if (field.type === "datetime-local" && typeof value === "string" && value)
          value = new Date(Date.parse(value) - 4 * 3600000).toISOString().slice(0, 16);
        return (
          <div
            className={field.type === "checkbox" ? "platform-checkbox" : "field"}
            key={field.name}
          >
            <label htmlFor={fieldId}>{localize(field.label)}</label>
            {field.type === "textarea" ? (
              <textarea
                id={fieldId}
                name={field.name}
                rows={4}
                required={field.required !== false}
                maxLength={field.maxLength || 2000}
                defaultValue={String(value ?? "")}
                disabled={busy}
              />
            ) : field.type === "select" ? (
              <select
                id={fieldId}
                name={field.name}
                required={field.required !== false}
                defaultValue={String(value ?? "")}
                disabled={busy}
              >
                {!field.options?.some((o) => o.value === "") && (
                  <option value="">{localize("Selecione")}</option>
                )}
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {localize(option.label)}
                  </option>
                ))}
              </select>
            ) : field.type === "checkbox" ? (
              <input
                id={fieldId}
                type="checkbox"
                name={field.name}
                defaultChecked={Boolean(value)}
                disabled={busy}
              />
            ) : (
              <input
                id={fieldId}
                name={field.name}
                type={field.type === "currency" ? "number" : field.type || "text"}
                required={field.required !== false}
                defaultValue={String(value ?? "")}
                min={field.min ?? (field.type === "currency" ? 0 : undefined)}
                max={field.max}
                step={
                  field.type === "currency" ? "0.01" : field.type === "number" ? "1" : undefined
                }
                maxLength={field.maxLength || 150}
                disabled={busy}
              />
            )}{" "}
            {field.hint && <span className="field-help">{localize(field.hint)}</span>}
          </div>
        );
      })}
      {feedback && (
        <p
          className={success ? "platform-success" : "form-error"}
          role={success ? "status" : "alert"}
        >
          {feedback}
        </p>
      )}
      <button type="submit" className="button button-dark" disabled={busy}>
        {busy ? localize("Salvando…") : localize(label)}
      </button>
    </form>
  );
}
