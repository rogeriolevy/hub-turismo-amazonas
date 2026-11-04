export const locales = ["pt", "en", "es"] as const;
export type Locale = (typeof locales)[number];
