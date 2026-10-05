"use client";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/site/language-provider";
import { TurnstileChallenge } from "./turnstile-challenge";
const credentials = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(128),
});

export function LoginForm({
  destination,
  turnstileSiteKey,
  captchaRequired,
}: {
  destination?: string;
  turnstileSiteKey: string;
  captchaRequired: boolean;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaReset, setCaptchaReset] = useState(0);
  const challengeEnabled = captchaRequired || Boolean(turnstileSiteKey);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = credentials.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      setError(t("auth.invalidCredentials"));
      return;
    }
    if (challengeEnabled && !captchaToken) {
      setError(t("auth.captchaRequiredLogin"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(captchaToken ? { "x-captcha-response": captchaToken } : {}),
        },
        body: JSON.stringify({ ...parsed.data, rememberMe: false }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          code?: string;
          error?: { code?: string };
        };
        if (
          ["MISSING_RESPONSE", "VERIFICATION_FAILED"].includes(
            payload.code ?? payload.error?.code ?? "",
          )
        )
          setError(t("auth.captchaExpired"));
        else if (response.status === 429) setError(t("auth.tooManyLogins"));
        else if (response.status === 401) setError(t("auth.badCredentials"));
        else if (response.status === 403) setError(t("auth.originDenied"));
        else if (response.status === 503) setError(t("auth.captchaNotConfigured"));
        else setError(t("auth.loginFailed"));
        setCaptchaToken("");
        if (challengeEnabled) setCaptchaReset((current) => current + 1);
        setBusy(false);
        return;
      }
      if (destination) router.push(destination);
      router.refresh();
    } catch (error) {
      setError(
        error instanceof TypeError
          ? "Verifique sua conexão e tente novamente."
          : (error as Error).message,
      );
      setBusy(false);
    }
  }
  return (
    <form className="admin-login" onSubmit={submit} aria-busy={busy}>
      <div className="field">
        <label htmlFor="admin-email">{t("auth.email")}</label>
        <input
          id="admin-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={254}
          disabled={busy}
          aria-describedby={error ? "login-error" : undefined}
        />
      </div>
      <div className="field">
        <label htmlFor="admin-password">{t("auth.password")}</label>
        <input
          id="admin-password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          maxLength={128}
          disabled={busy}
          aria-describedby={`login-help${capsLock ? " caps-lock-hint" : ""}${error ? " login-error" : ""}`}
          onKeyDown={(event) => setCapsLock(event.getModifierState("CapsLock"))}
          onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))}
          onBlur={() => setCapsLock(false)}
        />
        <button
          type="button"
          className="text-link"
          disabled={busy}
          aria-controls="admin-password"
          aria-pressed={showPassword}
          onClick={() => setShowPassword((visible) => !visible)}
        >
          {showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
        </button>
        {capsLock && (
          <p id="caps-lock-hint" className="field-help" role="status">
            {t("auth.capsLock")}
          </p>
        )}
      </div>
      <p id="login-help" className="field-help">
        {t("auth.loginHelp")}
      </p>
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
        <p id="login-error" className="form-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="button button-dark"
        type="submit"
        disabled={busy || (challengeEnabled && (!turnstileSiteKey || !captchaToken))}
      >
        {busy ? t("auth.loggingIn") : t("auth.login")}
      </button>
      <span className="sr-only" role="status">
        {busy ? t("auth.validateAccess") : ""}
      </span>
    </form>
  );
}
export function SignOutButton({ showIcon = false }: { showIcon?: boolean } = {}) {
  const router = useRouter();
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signOut() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error(t("auth.signOutFailed"));
      router.refresh();
    } catch {
      setError(t("auth.signOutFailed"));
      setBusy(false);
    }
  }
  return (
    <div>
      <button className="text-link" onClick={signOut} disabled={busy}>
        {showIcon && <LogOut size={16} aria-hidden="true" />}
        {busy ? t("auth.signingOut") : t("auth.signOut")}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
