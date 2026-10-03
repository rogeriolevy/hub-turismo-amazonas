"use client";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
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
      setError("Informe um e-mail válido e sua senha.");
      return;
    }
    if (challengeEnabled && !captchaToken) {
      setError("Confirme a verificação antirobô antes de entrar.");
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
          setError("A verificação antirobô expirou ou falhou. Confirme-a novamente.");
        else if (response.status === 429)
          setError("Muitas tentativas. Aguarde um minuto e tente novamente.");
        else if (response.status === 401)
          setError(
            "E-mail ou senha incorretos. Confira a digitação, incluindo maiúsculas e espaços.",
          );
        else if (response.status === 403)
          setError(
            "A origem deste acesso não foi autorizada. Abra o painel pelo endereço configurado para o site.",
          );
        else if (response.status === 503)
          setError("A verificação antirobô ainda não está configurada neste ambiente.");
        else setError("Não foi possível entrar agora. Tente novamente em instantes.");
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
        <label htmlFor="admin-email">E-mail</label>
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
        <label htmlFor="admin-password">Senha</label>
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
          {showPassword ? "Ocultar senha" : "Mostrar senha"}
        </button>
        {capsLock && (
          <p id="caps-lock-hint" className="field-help" role="status">
            Caps Lock está ativado.
          </p>
        )}
      </div>
      <p id="login-help" className="field-help">
        Use a senha criada para esta instalação. Para recuperar o acesso, fale com o responsável
        pelo site.
      </p>
      {turnstileSiteKey ? (
        <TurnstileChallenge
          siteKey={turnstileSiteKey}
          onToken={setCaptchaToken}
          resetKey={captchaReset}
        />
      ) : captchaRequired ? (
        <p className="field-help" role="alert">
          Verificação antirobô indisponível. Configure TURNSTILE_SITE_KEY e TURNSTILE_SECRET_KEY.
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
        {busy ? "Entrando…" : "Entrar"}
      </button>
      <span className="sr-only" role="status">
        {busy ? "Validando acesso" : ""}
      </span>
    </form>
  );
}
export function SignOutButton({ showIcon = false }: { showIcon?: boolean } = {}) {
  const router = useRouter();
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
      if (!response.ok) throw new Error("Não foi possível sair. Tente novamente.");
      router.refresh();
    } catch {
      setError("Não foi possível sair. Tente novamente.");
      setBusy(false);
    }
  }
  return (
    <div>
      <button className="text-link" onClick={signOut} disabled={busy}>
        {showIcon && <LogOut size={16} aria-hidden="true" />}
        {busy ? "Saindo…" : "Sair"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
