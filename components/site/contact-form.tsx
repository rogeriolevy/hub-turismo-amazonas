"use client";
import { useRef, useState } from "react";
import { ArrowUpRight, CheckCircle2, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/components/site/language-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { contactSchema, interests } from "@/lib/contact-schema";
import { translateText, type MessageKey } from "@/lib/i18n/messages";
type Errors = Record<string, string[] | undefined>;
const interestKeys: Record<(typeof interests)[number], MessageKey> = {
  "Conhecer a solução": "contact.interestSolution",
  "Hotel ou pousada": "contact.interestHotel",
  Parcerias: "contact.interestPartners",
  Privacidade: "contact.interestPrivacy",
  "Outro assunto": "contact.interestOther",
};
export function ContactForm() {
  const { locale, t } = useLanguage();
  const [interest, setInterest] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState("");
  const key = useRef<string | null>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  function fieldError(name: string) {
    return errors[name] ? (
      <span className="field-error" id={name + "-error"}>
        {translateText(locale, errors[name]?.[0] ?? "")}
      </span>
    ) : null;
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "loading") return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const result = contactSchema.safeParse({ ...data, interest, consent });
    if (!result.success) {
      setErrors(result.error.flatten().fieldErrors);
      setStatus("error");
      setMessage(t("contact.reviewFields"));
      requestAnimationFrame(() =>
        (form.querySelector('[aria-invalid="true"]') as HTMLElement)?.focus(),
      );
      return;
    }
    setErrors({});
    setStatus("loading");
    setMessage("");
    key.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/contatos", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key.current },
        body: JSON.stringify(result.data),
        signal: AbortSignal.timeout(15000),
      });
      const payload = (await response.json()) as {
        error?: { fields?: Errors; message?: string };
        data: { message: string };
      };
      if (!response.ok) {
        setErrors(payload.error?.fields || {});
        if (response.status === 409) key.current = null;
        throw new Error(payload.error?.message || t("contact.sendFailed"));
      }
      setStatus("success");
      setMessage(payload.data.message);
      form.reset();
      setInterest("");
      setConsent(false);
      key.current = null;
      requestAnimationFrame(() => feedback.current?.focus());
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error && error.name !== "TimeoutError" && error.name !== "TypeError"
          ? error.message
          : t("contact.connectionFailed"),
      );
    }
  }
  return (
    <div className="contact-card">
      {status === "success" ? (
        <div className="form-success" ref={feedback} tabIndex={-1} role="status">
          <CheckCircle2 size={42} />
          <h3>{t("contact.successTitle")}</h3>
          <p>{translateText(locale, message)}</p>
          <p>{t("contact.successNote")}</p>
          <button
            className="button button-dark"
            onClick={() => {
              setStatus("idle");
              setMessage("");
              requestAnimationFrame(() => nameInput.current?.focus());
            }}
          >
            {t("contact.sendAnother")}
          </button>
        </div>
      ) : (
        <>
          <h3>{t("contact.title")}</h3>
          <p className="form-intro">{t("contact.intro")}</p>
          <form noValidate onSubmit={submit} aria-busy={status === "loading"}>
            <div className="field">
              <label htmlFor="name">{t("contact.yourName")}</label>
              <input
                id="name"
                ref={nameInput}
                name="name"
                autoComplete="name"
                maxLength={100}
                required
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "name-error" : undefined}
                placeholder={t("contact.namePlaceholder")}
              />
              {fieldError("name")}
            </div>
            <div className="field">
              <label htmlFor="email">{t("contact.email")}</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                placeholder="voce@exemplo.com"
              />
              {fieldError("email")}
            </div>
            <div className="field">
              <label htmlFor="organization">
                {t("contact.organization")} <span>{t("contact.optional")}</span>
              </label>
              <input
                id="organization"
                name="organization"
                autoComplete="organization"
                maxLength={120}
                aria-invalid={!!errors.organization}
                aria-describedby={errors.organization ? "organization-error" : undefined}
                placeholder={t("contact.organizationPlaceholder")}
              />
              {fieldError("organization")}
            </div>
            <div className="field">
              <label htmlFor="interest">{t("contact.interest")}</label>
              <Select value={interest} onValueChange={setInterest}>
                <SelectTrigger
                  id="interest"
                  aria-required="true"
                  aria-invalid={!!errors.interest}
                  aria-describedby={errors.interest ? "interest-error" : undefined}
                  className="form-select"
                >
                  <SelectValue placeholder={t("contact.selectInterest")} />
                </SelectTrigger>
                <SelectContent>
                  {interests.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(interestKeys[value])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldError("interest")}
            </div>
            <div className="field">
              <label htmlFor="message">{t("contact.message")}</label>
              <textarea
                id="message"
                name="message"
                rows={4}
                maxLength={2000}
                required
                aria-invalid={!!errors.message}
                aria-describedby={errors.message ? "message-error" : "message-help"}
                placeholder={t("contact.messagePlaceholder")}
              />
              <span className="field-help" id="message-help">
                {t("contact.messageHelp")}
              </span>
              {fieldError("message")}
            </div>
            <div className="honeypot" aria-hidden="true">
              <label htmlFor="website">{t("contact.honeypot")}</label>
              <input id="website" name="website" tabIndex={-1} autoComplete="off" />
            </div>
            <div className="consent">
              <Checkbox
                id="consent"
                checked={consent}
                onCheckedChange={(value) => setConsent(value === true)}
                aria-required="true"
                aria-invalid={!!errors.consent}
                aria-describedby={errors.consent ? "consent-error" : undefined}
              />
              <label htmlFor="consent">
                {t("contact.consentLead")}{" "}
                <a href="/privacidade" target="_blank" rel="noreferrer">
                  {t("contact.privacyLink")}
                </a>
                .
              </label>
            </div>
            {fieldError("consent")}
            {status === "error" && (
              <p className="form-error" role="alert">
                {translateText(locale, message)}
              </p>
            )}
            <button
              className="button button-dark submit-button"
              type="submit"
              disabled={status === "loading"}
            >
              {status === "loading" ? (
                <>
                  {t("contact.sending")} <Loader2 className="animate-spin" size={18} />
                </>
              ) : (
                <>
                  {t("contact.submit")} <ArrowUpRight size={18} />
                </>
              )}
            </button>
            <span className="sr-only" role="status">
              {status === "loading" ? t("contact.wait") : ""}
            </span>
          </form>
        </>
      )}
    </div>
  );
}
