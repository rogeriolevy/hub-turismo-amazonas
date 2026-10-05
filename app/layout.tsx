import type { Metadata } from "next";
import { siteUrl } from "@/lib/site-config";
import { getLocale } from "@/lib/i18n/server";
import { htmlLanguage, translate } from "@/lib/i18n/messages";
import { LanguageProvider } from "@/components/site/language-provider";
import "./globals.css";
import "./platform.css";
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: translate(locale, "site.title"),
      template: "%s | Hub Turismo Amazonas",
    },
    description: translate(locale, "site.description"),
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      locale: locale === "pt" ? "pt_BR" : locale === "en" ? "en_US" : "es_ES",
      siteName: "Hub Turismo Amazonas",
      title: translate(locale, "site.openGraphTitle"),
      description: translate(locale, "site.openGraphDescription"),
    },
    icons: { icon: "/favicon.svg" },
  };
}
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={htmlLanguage(locale)}>
      <body>
        <LanguageProvider initialLocale={locale}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
