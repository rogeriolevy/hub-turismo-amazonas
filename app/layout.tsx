import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL("https://hub-turismo-amazonas.chirpy-tick-5066.chatgpt.site"),
  title: {
    default: "Hub Turismo Amazonas | Tecnologia que acolhe",
    template: "%s | Hub Turismo Amazonas",
  },
  description:
    "Tecnologia com raízes amazônicas. Conheça a proposta da Hub Turismo Amazonas para conectar pessoas e apoiar hotéis e pousadas de Maués.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Hub Turismo Amazonas",
    title: "Hub Turismo Amazonas | Tecnologia que acolhe",
    description: "Conectando pessoas. Valorizando a Amazônia.",
  },
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
