import { pt } from "./catalog-pt";
import { en } from "./catalog-en";
import { es } from "./catalog-es";
import { interfacePhrases } from "./interface-phrases";
import { locales, type Locale } from "./locales";
import type { MessageKey } from "./catalog-pt";

export { locales } from "./locales";
export type { Locale } from "./locales";
export type { MessageKey } from "./catalog-pt";

type Messages = Record<MessageKey, string>;
export const messages: Record<Locale, Messages> = { pt, en, es };

const portugueseMessageKeys = new Map<string, MessageKey>(
  Object.entries(pt).map(([key, value]) => [value, key as MessageKey]),
);
const normalizedPortugueseMessageKeys = new Map<string, MessageKey>(
  Object.entries(pt).map(([key, value]) => [value.replace(/\s+/g, " ").trim(), key as MessageKey]),
);

export function translate(
  locale: Locale,
  key: MessageKey,
  values?: Record<string, string | number>,
) {
  let message = messages[locale][key] ?? messages.pt[key];
  if (values) {
    for (const [name, value] of Object.entries(values)) {
      message = message.replaceAll(`{${name}}`, String(value));
    }
  }
  return message;
}

export function translateText(locale: Locale, value: string) {
  if (locale === "pt") return value;
  const normalized = value.replace(/\s+/g, " ").trim();
  const exactKey = portugueseMessageKeys.get(value);
  const key = exactKey ?? normalizedPortugueseMessageKeys.get(normalized);
  if (exactKey) return translate(locale, exactKey);
  if (key) {
    const leading = value.match(/^\s*/)?.[0] ?? "";
    const trailing = value.match(/\s*$/)?.[0] ?? "";
    return leading + translate(locale, key) + trailing;
  }
  const phrases = interfacePhrases[locale];
  const exactPhrase = phrases[normalized];
  if (exactPhrase) {
    const leading = value.match(/^\s*/)?.[0] ?? "";
    const trailing = value.match(/\s*$/)?.[0] ?? "";
    return leading + exactPhrase + trailing;
  }

  let localized = value;
  for (const [source, target] of Object.entries(phrases).sort(([a], [b]) => b.length - a.length)) {
    const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const before = /^[\p{L}\p{N}_]/u.test(source) ? "(?<![\\p{L}\\p{N}_])" : "";
    const after = /[\p{L}\p{N}_]$/u.test(source) ? "(?![\\p{L}\\p{N}_])" : "";
    localized = localized.replace(new RegExp(`${before}${escaped}${after}`, "gu"), target);
  }
  return localized;
}

export function isLocale(value: string | undefined): value is Locale {
  return locales.some((locale) => locale === value);
}

export function htmlLanguage(locale: Locale) {
  return locale === "pt" ? "pt-BR" : locale === "en" ? "en" : "es";
}
