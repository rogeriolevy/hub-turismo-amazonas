"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/site/language-provider";
import { translateText } from "@/lib/i18n/messages";
import { ActionFormFields } from "./action-form/fields";
import { prepareActionSubmission } from "./action-form/submission";
import type { Field, Values } from "./action-form/types";

export type { Field } from "./action-form/types";

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
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [success, setSuccess] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({
    ...Object.fromEntries(
      Object.entries(initial).map(([key, value]) => [key, String(value ?? "")]),
    ),
    ...Object.fromEntries(Object.entries(fixed).map(([key, value]) => [key, String(value ?? "")])),
  });
  const formRef = useRef<HTMLFormElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const prepared = prepareActionSubmission(
      action,
      fields,
      fixed,
      new FormData(event.currentTarget),
    );
    if (!prepared.ok) {
      setSuccess(false);
      setFeedback(prepared.feedback);
      return;
    }

    setBusy(true);
    setFeedback("");
    setSuccess(false);
    try {
      const response = await fetch("/api/plataforma/" + action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prepared.body),
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
      <ActionFormFields
        action={action}
        fields={fields}
        fixed={fixed}
        initial={initial}
        fieldValues={fieldValues}
        busy={busy}
        locale={locale}
        onFieldValueChange={(name, value) =>
          setFieldValues((previous) => ({ ...previous, [name]: value }))
        }
      />
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
