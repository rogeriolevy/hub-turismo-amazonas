"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { z } from "zod";
import { useLanguage } from "@/components/site/language-provider";
import { TurnstileChallenge } from "@/components/site/turnstile-challenge";

const emailSchema = z.string().trim().email();
const passwordSchema = z.string().min(12).max(128);

function responseCode(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const value = payload as { code?: string; error?: { code?: string } };
  return value.code ?? value.error?.code ?? "";
}

export function AccountEmailRequestForm({
  mode,
  emailDeliveryEnabled,
  turnstileSiteKey,
  captchaRequired,
}: {
  mode: "reset" | "verification";
  emailDeliveryEnabled: boolean;
  turnstileSiteKey: string;
  captchaRequired: boolean;
}) {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaReset, setCaptchaReset] = useState(0);
  const challengeEnabled = captchaRequired || Boolean(turnstileSiteKey);
  const endpoint =
    mode === "reset" ? "/api/auth/request-password-reset" : "/api/auth/send-verification-email";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailDeliveryEnabled) return;
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) {
      setError(t("auth.invalidEmail"));
      return;
    }
    if (challengeEnabled && !captchaToken) {
      setError(t("auth.captchaRequired"));
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(captchaToken ? { "x-captcha-response": captchaToken } : {}),
        },
        body: JSON.stringify(
          mode === "reset"
            ? { email: parsedEmail.data, redirectTo: "/redefinir-senha" }
            : { email: parsedEmail.data, callbackURL: "/entrar?email-verificado=1" },
        ),
        signal: AbortSignal.timeout(15_000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const code = responseCode(payload);
        setError(
          code === "MISSING_RESPONSE" || code === "VERIFICATION_FAILED"
            ? t("auth.captchaExpired")
            : response.status === 429
              ? t("auth.emailRequestRateLimited")
              : response.status === 503
                ? t("auth.emailUnavailable")
                : t("auth.emailRequestFailed"),
        );
        setCaptchaToken("");
        if (challengeEnabled) setCaptchaReset((current) => current + 1);
        return;
      }
      setSent(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error && requestError.name !== "TimeoutError"
          ? t("auth.emailRequestFailed")
          : t("auth.connectionRetry"),
      );
    } finally {
      setBusy(false);
    }
  }

  if (!emailDeliveryEnabled)
    return (
      <div className="portal-empty" role="status">
        <p>{t("auth.emailUnavailable")}</p>
        <Link href="/entrar" className="button button-dark">
          {t("auth.backToLogin")}
        </Link>
      </div>
    );

  if (sent)
    return (
      <div className="portal-empty" role="status">
        <h2>{mode === "reset" ? t("auth.resetRequestSent") : t("auth.verificationRequestSent")}</h2>
        <p>{t("auth.emailRequestSentHelp")}</p>
        <Link href="/entrar" className="button button-dark">
          {t("auth.backToLogin")}
        </Link>
      </div>
    );

  return (
    <form className="platform-form" onSubmit={submit} aria-busy={busy}>
      <div className="field">
        <label htmlFor={`account-email-${mode}`}>{t("auth.email")}</label>
        <input
          id={`account-email-${mode}`}
          type="email"
          autoComplete="email"
          maxLength={254}
          required
          disabled={busy}
          value={email}
          onChange={(event) => setEmail(event.currentTarget.value)}
        />
      </div>
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
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="button button-dark"
        type="submit"
        disabled={busy || (challengeEnabled && (!turnstileSiteKey || !captchaToken))}
      >
        {busy
          ? t("auth.emailRequestSending")
          : mode === "reset"
            ? t("auth.requestPasswordReset")
            : t("auth.sendVerificationEmail")}
      </button>
      <Link href="/entrar" className="text-link">
        {t("auth.backToLogin")}
      </Link>
    </form>
  );
}

export function PasswordResetForm({ token }: { token: string }) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = passwordSchema.safeParse(form.get("password"));
    if (!parsed.success) {
      setError(t("auth.passwordHelp"));
      return;
    }
    if (form.get("confirm") !== parsed.data) {
      setError(t("auth.passwordsMismatch"));
      return;
    }
    if (!token) {
      setError(t("auth.resetTokenInvalid"));
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: parsed.data, token }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        setError(
          response.status === 429 ? t("auth.emailRequestRateLimited") : t("auth.resetTokenInvalid"),
        );
        return;
      }
      setDone(true);
    } catch {
      setError(t("auth.connectionRetry"));
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <div className="portal-empty" role="status">
        <h2>{t("auth.passwordResetComplete")}</h2>
        <p>{t("auth.passwordResetCompleteHelp")}</p>
        <Link href="/entrar" className="button button-dark">
          {t("auth.backToLogin")}
        </Link>
      </div>
    );

  return (
    <form className="platform-form" onSubmit={submit} aria-busy={busy}>
      {!token && (
        <p className="form-error" role="alert">
          {t("auth.resetTokenInvalid")}
        </p>
      )}
      <div className="field">
        <label htmlFor="reset-password">{t("auth.password")}</label>
        <input
          id="reset-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          disabled={busy || !token}
        />
        <span className="field-help">{t("auth.passwordHelp")}</span>
      </div>
      <div className="field">
        <label htmlFor="reset-password-confirm">{t("auth.confirmPassword")}</label>
        <input
          id="reset-password-confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          disabled={busy || !token}
        />
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button-dark" type="submit" disabled={busy || !token}>
        {busy ? t("auth.passwordResetting") : t("auth.resetPassword")}
      </button>
    </form>
  );
}
