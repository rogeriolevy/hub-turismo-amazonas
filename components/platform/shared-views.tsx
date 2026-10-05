import { Compass } from "lucide-react";
import type { ReactNode } from "react";
import { translateText, type Locale } from "@/lib/i18n/messages";

export function LocalizedPageIntro({
  locale,
  eyebrow,
  title,
  description,
}: {
  locale: Locale;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="portal-intro">
      <p className="eyebrow">{translateText(locale, eyebrow)}</p>
      <h1>{translateText(locale, title)}</h1>
      <p>{translateText(locale, description)}</p>
    </div>
  );
}

export function LocalizedEmptyState({
  locale,
  title,
  children,
}: {
  locale: Locale;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="portal-empty">
      <Compass size={36} />
      <h2>{translateText(locale, title)}</h2>
      <div>{typeof children === "string" ? translateText(locale, children) : children}</div>
    </div>
  );
}

export function LocalizedPortalNotice({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <div className="portal-notice">
      {typeof children === "string" ? translateText(locale, children) : children}
    </div>
  );
}
