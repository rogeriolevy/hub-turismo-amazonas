import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BedDouble,
  BriefcaseBusiness,
  Compass,
  Ship,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { Header, Footer } from "@/components/site/navigation";
import { localizeModule, publicModules } from "@/components/platform/shared";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/messages";
import { getSession } from "@/server/admin";
import "./platform-entry.css";

export const metadata: Metadata = {
  title: "Acessar a plataforma",
  description:
    "Acesse os catálogos de hospedagem, navegação, gastronomia, experiências e serviços turísticos de Maués.",
  alternates: { canonical: "/plataforma" },
};
export const dynamic = "force-dynamic";

const moduleIcons = {
  "/hospedagens": BedDouble,
  "/gastronomia": UtensilsCrossed,
  "/experiencias": Compass,
  "/agencias": BriefcaseBusiness,
  "/servicos": Sparkles,
  "/navegacao": Ship,
} as const;

const moduleOrder = [
  "/hospedagens",
  "/navegacao",
  "/gastronomia",
  "/experiencias",
  "/agencias",
  "/servicos",
];

export default async function PlatformEntryPage() {
  const [locale, session] = await Promise.all([getLocale(), getSession().catch(() => null)]);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const modules = moduleOrder
    .map((href) => publicModules.find((module) => module.href === href))
    .filter((module) => module !== undefined)
    .map((module) => localizeModule(module, locale));
  const accountHref = session ? "/minha-conta" : "/entrar?voltar=%2Fminha-conta";

  return (
    <>
      <Header />
      <main className="platform-entry" id="conteudo" tabIndex={-1}>
        <section className="platform-entry-hero">
          <div className="container platform-entry-hero-inner">
            <p className="platform-entry-eyebrow">{t("platform.entry.eyebrow")}</p>
            <h1>{t("platform.entry.title")}</h1>
            <p className="platform-entry-lead">{t("platform.entry.description")}</p>
            <a className="platform-entry-scroll" href="#servicos-plataforma">
              {t("platform.entry.sectionTitle")} <ArrowRight size={17} aria-hidden="true" />
            </a>
          </div>
        </section>

        <section
          className="container platform-entry-services"
          id="servicos-plataforma"
          aria-labelledby="platform-entry-services-title"
        >
          <div className="platform-entry-section-heading">
            <div>
              <p className="platform-entry-kicker">HUB TURISMO AMAZONAS</p>
              <h2 id="platform-entry-services-title">{t("platform.entry.sectionTitle")}</h2>
            </div>
            <p>{t("platform.entry.sectionDescription")}</p>
          </div>

          <div className="platform-entry-grid">
            {modules.map((module, index) => {
              const Icon = moduleIcons[module.href as keyof typeof moduleIcons];
              if (!Icon) return null;
              return (
                <Link
                  className="platform-entry-card"
                  href={module.href}
                  key={module.href}
                  style={{ animationDelay: `${index * 55}ms` }}
                >
                  <span className="platform-entry-card-icon">
                    <Icon size={24} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <span className="platform-entry-card-copy">
                    <strong>{module.label}</strong>
                    <span>{module.description}</span>
                  </span>
                  <ArrowUpRight
                    className="platform-entry-card-arrow"
                    size={19}
                    aria-hidden="true"
                  />
                </Link>
              );
            })}
          </div>

          <Link className="platform-entry-account" href={accountHref}>
            <span className="platform-entry-account-copy">
              <strong>{t("platform.entry.accountTitle")}</strong>
              <span>
                {session
                  ? t("platform.entry.signedInDescription")
                  : t("platform.entry.accountDescription")}
              </span>
            </span>
            <span className="platform-entry-account-action">
              {session ? t("platform.entry.signedInAction") : t("platform.entry.accountAction")}
              <ArrowRight size={17} aria-hidden="true" />
            </span>
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
