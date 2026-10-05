"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useLanguage } from "./language-provider";
import type { Locale } from "@/lib/i18n/messages";

const options: {
  locale: Locale;
  flag: string;
  short: string;
  labelKey: "language.portuguese" | "language.english" | "language.spanish";
}[] = [
  { locale: "pt", flag: "🇧🇷", short: "PT", labelKey: "language.portuguese" },
  { locale: "en", flag: "🇬🇧", short: "EN", labelKey: "language.english" },
  { locale: "es", flag: "🇪🇸", short: "ES", labelKey: "language.spanish" },
];

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLanguage();
  const router = useRouter();
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.locale === locale) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function closeOnOutside(event: PointerEvent) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        menuRef.current?.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  async function selectLanguage(nextLocale: Locale) {
    setOpen(false);
    if (nextLocale === locale) return;
    setLocale(nextLocale);
    try {
      const response = await fetch("/api/preferences/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      });
      if (!response.ok) throw new Error("Não foi possível salvar o idioma.");
      router.refresh();
    } catch {
      setLocale(locale);
    }
  }

  return (
    <details
      className="language-switcher"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      ref={menuRef}
    >
      <summary
        aria-label={`${t("language.label")}: ${t(current.labelKey)}`}
        aria-expanded={open}
        className="language-trigger"
        title={`${t("language.label")}: ${t(current.labelKey)}`}
      >
        <span aria-hidden="true" className="language-flag">
          {current.flag}
        </span>
        <span className="language-code">{current.short}</span>
        <ChevronDown aria-hidden="true" className="language-chevron" size={12} />
      </summary>
      <div className="language-menu" role="group" aria-label={t("language.label")}>
        {options.map(({ locale: optionLocale, flag, short, labelKey }) => (
          <button
            aria-current={locale === optionLocale ? "true" : undefined}
            className="language-option"
            key={optionLocale}
            onClick={() => void selectLanguage(optionLocale)}
            title={t(labelKey)}
            type="button"
          >
            <span aria-hidden="true" className="language-flag">
              {flag}
            </span>
            <span className="language-code">{short}</span>
          </button>
        ))}
      </div>
    </details>
  );
}
