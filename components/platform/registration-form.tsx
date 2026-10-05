"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { registrationSchema } from "@/lib/platform-schema";
import { useLanguage } from "@/components/site/language-provider";
import { TurnstileChallenge } from "@/components/site/turnstile-challenge";
export function RegistrationForm({
  onCreated,
  turnstileSiteKey,
  captchaRequired,
}: {
  onCreated?: () => void;
  turnstileSiteKey: string;
  captchaRequired: boolean;
}) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false),
    [captchaToken, setCaptchaToken] = useState(""),
    [captchaReset, setCaptchaReset] = useState(0);
  const challengeEnabled = captchaRequired || Boolean(turnstileSiteKey);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const parsed = registrationSchema.safeParse({
      name: form.get("name"),
      email: form.get("email"),
      phoneNumber: form.get("phoneNumber"),
      password: form.get("password"),
      consent: form.has("consent"),
    });
    if (!parsed.success) {
      setError(t("auth.invalidRegistrationData"));
      return;
    }
    if (form.get("confirm") !== parsed.data.password) {
      setError(t("auth.passwordsMismatch"));
      return;
    }
    if (challengeEnabled && !captchaToken) {
      setError(t("auth.captchaRequired"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/conta/cadastro", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(captchaToken ? { "x-captcha-response": captchaToken } : {}),
        },
        body: JSON.stringify(parsed.data),
        signal: AbortSignal.timeout(15000),
      });
      const payload = await response.json();
      if (!response.ok) {
        setCaptchaToken("");
        if (challengeEnabled) setCaptchaReset((current) => current + 1);
        const code = payload.code ?? payload.error?.code;
        throw new Error(
          ["MISSING_RESPONSE", "VERIFICATION_FAILED"].includes(code)
            ? t("auth.captchaExpired")
            : payload.error?.message ||
                (response.status === 429
                  ? t("auth.tooManySignups")
                  : response.status === 503
                    ? t("auth.captchaNotConfigured")
                    : t("auth.signupFailed")),
        );
      }
      setDone(true);
      onCreated?.();
    } catch (error) {
      setError(
        error instanceof Error && error.name !== "TypeError" && error.name !== "TimeoutError"
          ? error.message
          : t("auth.connectionRetry"),
      );
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <div className="portal-empty" role="status">
        <h2>{t("auth.accountCreated")}</h2>
        <p>{t("auth.accountCreatedHelp")}</p>
        <Link href="/entrar" className="button button-dark">
          {t("auth.loginToAccount")}
        </Link>
      </div>
    );
  return (
    <form className="platform-form" onSubmit={submit} aria-busy={busy}>
      <div className="field">
        <label htmlFor="signup-name">{t("auth.name")}</label>
        <input
          id="signup-name"
          name="name"
          autoComplete="name"
          minLength={2}
          maxLength={100}
          required
          disabled={busy}
        />
      </div>
      <div className="field">
        <label htmlFor="signup-email">{t("auth.email")}</label>
        <input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          required
          disabled={busy}
        />
      </div>
      <div className="field">
        <label htmlFor="signup-phone">{t("auth.phone")}</label>
        <input
          id="signup-phone"
          name="phoneNumber"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(92) 99999-1234"
          maxLength={20}
          required
          disabled={busy}
        />
        <span className="field-help">{t("auth.phoneHelp")}</span>
      </div>
      <div className="field">
        <label htmlFor="signup-password">{t("auth.password")}</label>
        <input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          disabled={busy}
        />
        <span className="field-help">{t("auth.passwordHelp")}</span>
      </div>
      <div className="field">
        <label htmlFor="signup-confirm">{t("auth.confirmPassword")}</label>
        <input
          id="signup-confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          disabled={busy}
        />
      </div>
      <label className="platform-consent">
        <input type="checkbox" name="consent" required disabled={busy} />
        <span>
          {t("auth.privacyLead")}{" "}
          <Link href="/privacidade" target="_blank">
            {t("auth.privacyOpen")}
          </Link>{" "}
          {t("auth.privacyTail")}
        </span>
      </label>
      {turnstileSiteKey ? (
        <TurnstileChallenge
          siteKey={turnstileSiteKey}
          onToken={setCaptchaToken}
          resetKey={captchaReset}
        />
      ) : captchaRequired ? (
        <p className="field-help" role="alert">
          {t("auth.captchaUnavailable")}
        </p>
      ) : null}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button
        className="button button-dark"
        disabled={busy || (challengeEnabled && (!turnstileSiteKey || !captchaToken))}
      >
        {busy ? t("auth.creatingAccount") : t("auth.createMyAccount")}
      </button>
      <p className="field-help">{t("auth.teamAccessNote")}</p>
    </form>
  );
}
