import Image from "next/image";
import { ArrowDown, ArrowUpRight, Ship, Plane } from "lucide-react";
import { Header, Footer } from "@/components/site/navigation";
import { NavigationExplorer } from "@/components/platform/navigation-explorer";
import { HubContentGrid } from "@/components/platform/provider-directory";
import { getDatabase } from "@/db";
import { publicCatalogItems } from "@/server/catalog-content-service";
import { todayInManaus } from "@/lib/platform-schema";
import "./navigation.css";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/messages";
import { LocalizedTree } from "@/lib/i18n/localized-tree";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Navegação e transporte no Amazonas",
  description:
    "Planeje sua viagem por Maués, Manaus, Parintins e Boa Vista do Ramos. Roteiros de embarcações, referências de passagens aéreas e fluviais, contatos e pacotes.",
  alternates: { canonical: "/navegacao" },
};

type NavigationSearchParams = {
  origem?: string | string[];
  destino?: string | string[];
  modo?: string | string[];
  data?: string | string[];
  pessoas?: string | string[];
};

export default async function NavigationPage({
  searchParams,
}: {
  searchParams: Promise<NavigationSearchParams>;
}) {
  const search = await searchParams;
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const searchKey = JSON.stringify(search);
  const navigationItems = await publicCatalogItems(getDatabase(), "navegacao");
  return (
    <>
      <Header />
      <LocalizedTree>
        <main id="conteudo" tabIndex={-1} className="navigation-page">
          <section className="nav-hero" aria-labelledby="navigation-title">
            <div className="container nav-hero-inner">
              <div className="nav-hero-copy">
                <p className="eyebrow">{t("navigation.pageEyebrow")}</p>
                <h1 id="navigation-title">
                  {t("navigation.pageHeadline")}
                  <br />
                  {t("navigation.pageByAmazon")} <em>{t("navigation.pageAmazon")}</em>
                </h1>
                <p>{t("navigation.pageDescription")}</p>
                <div className="nav-hero-actions">
                  <a className="button button-dark" href="#passagens">
                    {t("navigation.exploreRoutes")} <ArrowDown size={17} aria-hidden="true" />
                  </a>
                  <a className="text-link" href="#horarios">
                    {t("navigation.boatTimes")} <ArrowUpRight size={17} aria-hidden="true" />
                  </a>
                </div>
                <div className="nav-hero-modes">
                  <span>
                    <Ship size={18} aria-hidden="true" />
                    {t("navigation.riverTransport")}
                  </span>
                  <span>
                    <Plane size={18} aria-hidden="true" />
                    {t("navigation.airTransport")}
                  </span>
                </div>
              </div>
              <figure className="nav-hero-art">
                <Image
                  src="/images/navegacao/rios-e-ceus.webp"
                  alt={t("navigation.illustration")}
                  width={1536}
                  height={1024}
                  sizes="(max-width: 800px) 100vw, 55vw"
                  priority
                />
                <figcaption>{t("navigation.generatedImage")}</figcaption>
              </figure>
            </div>
          </section>
          <nav className="nav-page-links" aria-label={t("navigation.pageSections")}>
            <div className="container">
              <a href="#passagens">{t("navigation.ticketsRoutes")}</a>
              <a href="#horarios">{t("navigation.timesContacts")}</a>
              <a href="#pacotes">{t("navigation.packages")}</a>
            </div>
          </nav>
          <div className="container">
            <NavigationExplorer key={searchKey} today={todayInManaus()} search={search} />
            <HubContentGrid items={navigationItems} title={t("navigation.operatorHeading")} />
          </div>
        </main>
      </LocalizedTree>
      <Footer photoCredit={false} />
    </>
  );
}
