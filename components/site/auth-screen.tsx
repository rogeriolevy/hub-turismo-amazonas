"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { PlatformBrand } from "@/components/platform/brand";
import { useLanguage } from "@/components/site/language-provider";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { RegistrationForm } from "@/components/platform/registration-form";
import { LoginForm } from "./admin-auth";
import { AccountEmailRequestForm, PasswordResetForm } from "./account-email-forms";
import "./auth-screen.css";

type AuthMode = "login" | "signup" | "recovery" | "verification" | "reset";

export function AuthScreen({
  initialMode,
  destination,
  turnstileSiteKey,
  captchaRequired,
  emailDeliveryEnabled,
  emailVerificationRequired,
  emailVerified = false,
  resetToken = "",
}: {
  initialMode: AuthMode;
  destination: string;
  turnstileSiteKey: string;
  captchaRequired: boolean;
  emailDeliveryEnabled: boolean;
  emailVerificationRequired: boolean;
  emailVerified?: boolean;
  resetToken?: string;
}) {
  const [mode, setMode] = useState(initialMode);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const { t } = useLanguage();
  const signingUp = mode === "signup";
  const standardMode = mode === "login" || signingUp;
  const heading =
    mode === "signup"
      ? [t("auth.signupTitle"), t("auth.signupDescription")]
      : mode === "recovery"
        ? [t("auth.recoveryTitle"), t("auth.recoveryDescription")]
        : mode === "verification"
          ? [t("auth.verificationTitle"), t("auth.verificationDescription")]
          : mode === "reset"
            ? [t("auth.resetTitle"), t("auth.resetDescription")]
            : [t("auth.loginTitle"), t("auth.loginDescription")];

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
          <h1 id="auth-title">{heading[0]}</h1>
          <p>{heading[1]}</p>
        </div>

        {standardMode && (
          <div className="auth-screen-switch" role="group" aria-label={t("auth.access")}>
            <button type="button" aria-pressed={!signingUp} onClick={() => setMode("login")}>
              {t("auth.login")}
            </button>
            <button type="button" aria-pressed={signingUp} onClick={() => setMode("signup")}>
              {t("auth.signup")}
            </button>
          </div>
        )}

        <div id="auth-panel" className="auth-screen-form">
          {registrationComplete && !signingUp && (
            <p className="auth-success" role="status">
              {emailDeliveryEnabled ? t("auth.createdWithVerification") : t("auth.created")}
            </p>
          )}
          {emailVerified && mode === "login" && (
            <p className="auth-success" role="status">
              {t("auth.emailVerified")}
            </p>
          )}
          {mode === "signup" ? (
            <RegistrationForm
              onCreated={showLoginAfterRegistration}
              emailDeliveryEnabled={emailDeliveryEnabled}
              turnstileSiteKey={turnstileSiteKey}
              captchaRequired={captchaRequired}
            />
          ) : mode === "login" ? (
            <LoginForm
              destination={destination}
              turnstileSiteKey={turnstileSiteKey}
              captchaRequired={captchaRequired}
              emailDeliveryEnabled={emailDeliveryEnabled}
              emailVerificationRequired={emailVerificationRequired}
            />
          ) : mode === "recovery" || mode === "verification" ? (
            <AccountEmailRequestForm
              mode={mode === "recovery" ? "reset" : "verification"}
              emailDeliveryEnabled={emailDeliveryEnabled}
              turnstileSiteKey={turnstileSiteKey}
              captchaRequired={captchaRequired}
            />
          ) : (
            <PasswordResetForm token={resetToken} />
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
