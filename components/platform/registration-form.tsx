"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { registrationSchema } from "@/lib/platform-schema";
export function RegistrationForm() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const parsed = registrationSchema.safeParse({
      name: form.get("name"),
      email: form.get("email"),
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
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/conta/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
        signal: AbortSignal.timeout(15000),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          payload.error?.message ||
            (response.status === 429
              ? "Muitas tentativas de cadastro. Tente mais tarde."
              : "Não foi possível criar a conta. Se já possui cadastro, use Entrar."),
        );
      setDone(true);
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
          e autorizo o uso dos dados para minha conta e solicitações.
        </span>
      </label>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button className="button button-dark" disabled={busy}>
        {busy ? "Criando conta…" : "Criar minha conta"}
      </button>
      <p className="field-help">
        O cadastro não concede acesso a empresas. Perfis de equipe são liberados pela administração.
      </p>
    </form>
  );
}
