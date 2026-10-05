"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { PlatformBrand } from "@/components/platform/brand";
import { useLanguage } from "@/components/site/language-provider";
import { LanguageSwitcher } from "@/components/site/language-switcher";
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
  const { t } = useLanguage();
  const signingUp = mode === "signup";

  function showLoginAfterRegistration() {
    setRegistrationComplete(true);
    setMode("login");
  }

  return (
    <main className="auth-screen">
      <div className="auth-screen-top">
        <PlatformBrand />
        <LanguageSwitcher />
        <Link className="auth-back-link" href="/">
          <ArrowLeft size={16} aria-hidden="true" />
          {t("auth.back")}
        </Link>
      </div>
      <section className="auth-screen-card" aria-labelledby="auth-title">
        <div className="auth-screen-heading">
          <span className="auth-screen-icon">
            <LockKeyhole size={20} aria-hidden="true" />
          </span>
          <p className="eyebrow">{t("auth.brand")}</p>
          <h1 id="auth-title">{signingUp ? t("auth.signupTitle") : t("auth.loginTitle")}</h1>
          <p>{signingUp ? t("auth.signupDescription") : t("auth.loginDescription")}</p>
        </div>

        <div className="auth-screen-switch" role="group" aria-label={t("auth.access")}>
          <button type="button" aria-pressed={!signingUp} onClick={() => setMode("login")}>
            {t("auth.login")}
          </button>
          <button type="button" aria-pressed={signingUp} onClick={() => setMode("signup")}>
            {t("auth.signup")}
          </button>
        </div>

        <div id="auth-panel" className="auth-screen-form">
          {registrationComplete && !signingUp && (
            <p className="auth-success" role="status">
              {t("auth.created")}
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
          {t("auth.privacyText")} <Link href="/privacidade">{t("auth.privacyLink")}</Link>
        </p>
      </section>
      <p className="auth-screen-footer">{t("auth.footer")}</p>
    </main>
  );
}
