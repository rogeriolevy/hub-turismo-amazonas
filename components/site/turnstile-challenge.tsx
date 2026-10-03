"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      theme: "auto";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function TurnstileChallenge({
  siteKey,
  onToken,
  resetKey,
}: {
  siteKey: string;
  onToken: (token: string) => void;
  resetKey: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const lastResetRef = useRef(resetKey);
  const [loadError, setLoadError] = useState(false);

  const renderWidget = useCallback(() => {
    const api = window.turnstile;
    if (!api || !containerRef.current || widgetIdRef.current) return;
    widgetIdRef.current = api.render(containerRef.current, {
      sitekey: siteKey,
      action: "auth",
      theme: "auto",
      callback: onToken,
      "expired-callback": () => onToken(""),
      "error-callback": () => {
        onToken("");
        setLoadError(true);
      },
    });
    setLoadError(false);
  }, [onToken, siteKey]);

  useEffect(() => {
    renderWidget();
    return () => {
      if (widgetIdRef.current) window.turnstile?.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, [renderWidget]);

  useEffect(() => {
    if (lastResetRef.current === resetKey) return;
    lastResetRef.current = resetKey;
    onToken("");
    if (widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current);
  }, [onToken, resetKey]);

  return (
    <div className="auth-turnstile" aria-label="Verificação antirobô">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={renderWidget}
        onError={() => setLoadError(true)}
      />
      <div ref={containerRef} data-sitekey={siteKey} />
      {loadError && (
        <p className="field-help" role="status">
          Não foi possível carregar a verificação. Atualize a página e tente novamente.
        </p>
      )}
    </div>
  );
}
