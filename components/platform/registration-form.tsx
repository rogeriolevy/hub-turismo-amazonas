"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { registrationSchema } from "@/lib/platform-schema";
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
      setError(parsed.error.issues[0].message);
      return;
    }
    if (form.get("confirm") !== parsed.data.password) {
      setError("As senhas não coincidem.");
      return;
    }
    if (challengeEnabled && !captchaToken) {
      setError("Confirme a verificação antirobô antes de criar a conta.");
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
            ? "A verificação antirobô expirou ou falhou. Confirme-a novamente."
            : payload.error?.message ||
                (response.status === 429
                  ? "Muitas tentativas de cadastro. Tente mais tarde."
                  : response.status === 503
                    ? "A verificação antirobô ainda não está configurada neste ambiente."
                    : "Não foi possível criar a conta. Se já possui cadastro, use Entrar."),
        );
      }
      setDone(true);
      onCreated?.();
    } catch (error) {
      setError(
        error instanceof Error && error.name !== "TypeError" && error.name !== "TimeoutError"
          ? error.message
          : "Verifique a conexão e tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <div className="portal-empty" role="status">
        <h2>Conta criada.</h2>
        <p>Agora entre com seu e-mail e sua senha para começar.</p>
        <Link href="/entrar" className="button button-dark">
          Entrar na minha conta
        </Link>
      </div>
    );
  return (
    <form className="platform-form" onSubmit={submit} aria-busy={busy}>
      <div className="field">
        <label htmlFor="signup-name">Nome</label>
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
        <label htmlFor="signup-email">E-mail</label>
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
        <label htmlFor="signup-phone">Celular com DDD</label>
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
        <span className="field-help">
          Validamos o formato e recusamos sequências obviamente fictícias. A confirmação de
          titularidade por SMS depende de um serviço de envio.
        </span>
      </div>
      <div className="field">
        <label htmlFor="signup-password">Senha</label>
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
        <span className="field-help">De 12 a 128 caracteres. Maiúsculas e espaços contam.</span>
      </div>
      <div className="field">
        <label htmlFor="signup-confirm">Confirme a senha</label>
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
          Li o{" "}
          <Link href="/privacidade" target="_blank">
            aviso de privacidade (nova aba)
          </Link>{" "}
          e autorizo o uso dos dados, incluindo meu celular, para minha conta e solicitações.
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
          Verificação antirobô indisponível. Configure TURNSTILE_SITE_KEY e TURNSTILE_SECRET_KEY.
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
        {busy ? "Criando conta…" : "Criar minha conta"}
      </button>
      <p className="field-help">
        O cadastro não concede acesso a empresas. Perfis de equipe são liberados pela administração.
      </p>
    </form>
  );
}
