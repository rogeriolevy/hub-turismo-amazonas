"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { PlatformBrand } from "@/components/platform/brand";
import { RegistrationForm } from "@/components/platform/registration-form";
import { LoginForm } from "./admin-auth";
import "./auth-screen.css";

type AuthMode = "login" | "signup";

export function AuthScreen({
  initialMode,
  destination,
  turnstileSiteKey,
  captchaRequired,
}: {
  initialMode: AuthMode;
  destination: string;
  turnstileSiteKey: string;
  captchaRequired: boolean;
}) {
  const [mode, setMode] = useState(initialMode);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const signingUp = mode === "signup";

  function showLoginAfterRegistration() {
    setRegistrationComplete(true);
    setMode("login");
  }

  return (
    <main className="auth-screen">
      <div className="auth-screen-top">
        <PlatformBrand />
        <Link className="auth-back-link" href="/">
          <ArrowLeft size={16} aria-hidden="true" />
          Voltar ao site
        </Link>
      </div>
      <section className="auth-screen-card" aria-labelledby="auth-title">
        <div className="auth-screen-heading">
          <span className="auth-screen-icon">
            <LockKeyhole size={20} aria-hidden="true" />
          </span>
          <p className="eyebrow">HUB TURISMO AMAZONAS</p>
          <h1 id="auth-title">{signingUp ? "Crie sua conta." : "Boas histórias começam aqui."}</h1>
          <p>
            {signingUp
              ? "Um cadastro simples para planejar sua viagem e acompanhar solicitações."
              : "Acesse suas reservas e acompanhe cada etapa da sua viagem."}
          </p>
        </div>

        <div className="auth-screen-switch" role="group" aria-label="Acesso à conta">
          <button type="button" aria-pressed={!signingUp} onClick={() => setMode("login")}>
            Entrar
          </button>
          <button type="button" aria-pressed={signingUp} onClick={() => setMode("signup")}>
            Criar conta
          </button>
        </div>

        <div id="auth-panel" className="auth-screen-form">
          {registrationComplete && !signingUp && (
            <p className="auth-success" role="status">
              Conta criada. Entre com o e-mail e a senha que acabou de cadastrar.
            </p>
          )}
          {signingUp ? (
            <RegistrationForm
              onCreated={showLoginAfterRegistration}
              turnstileSiteKey={turnstileSiteKey}
              captchaRequired={captchaRequired}
            />
          ) : (
            <LoginForm
              destination={destination}
              turnstileSiteKey={turnstileSiteKey}
              captchaRequired={captchaRequired}
            />
          )}
        </div>

        <p className="auth-screen-privacy">
          Seus dados são usados para sua conta e solicitações.{" "}
          <Link href="/privacidade">Aviso de privacidade</Link>
        </p>
      </section>
      <p className="auth-screen-footer">Turismo local, com quem conhece o Amazonas.</p>
    </main>
  );
}
