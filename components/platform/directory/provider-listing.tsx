import { MapPin } from "lucide-react";
import { Header, Footer } from "@/components/site/navigation";
import { getDatabase } from "@/db";
import { searchPublicHotels } from "@/server/catalog-service";
import {
  searchProviders,
  type DirectoryCategory,
  type DirectorySearch,
} from "@/server/cadastur/public-directory";
import { todayInManaus } from "@/lib/platform-schema/format";
import { normalizeStaySearch } from "@/lib/stay-search";
import { providerDirectoryModules as modules } from "./config";
import { ProviderSearchArea } from "./provider-search-area";
import { ProviderResults } from "./provider-results";
import { LodgingHighlights } from "./lodging-highlights";
import { BookableHotels } from "./bookable-hotels";
import { LocalizedTree } from "@/lib/i18n/localized-tree";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/messages";
import "../provider-directory.css";

export async function ProviderDirectory({
  category,
  search = {},
}: {
  category: DirectoryCategory;
  search?: DirectorySearch;
}) {
  const db = getDatabase();
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) =>
    translate(locale, key, values);
  const results = await searchProviders(db, category, search);
  const today = todayInManaus();
  const staySearch = normalizeStaySearch(search, today);
  const info = modules[category];
  const Icon = info.icon;
  const hotelResults =
    category === "hospedagens"
      ? await searchPublicHotels(db, {
          q: results.q,
          city: results.city,
          page: search.hotel_pagina,
        })
      : null;
  const directoryUrl = (page?: number, city = results.city) => {
    const params = new URLSearchParams({
      q: results.q,
      cidade: city,
      tipo: results.type,
      ...(page ? { pagina: String(page) } : {}),
    });
    if (category === "hospedagens") {
      if (staySearch.entrada && staySearch.saida) {
        params.set("entrada", staySearch.entrada);
        params.set("saida", staySearch.saida);
      }
      if (staySearch.pessoas !== "1") params.set("pessoas", staySearch.pessoas);
    }
    return "/" + category + "?" + params.toString();
  };
  const pageUrl = (page: number) => directoryUrl(page) + "#resultados";
  const hotelPageUrl = (target: number) => {
    const params = new URLSearchParams({
      q: results.q,
      cidade: results.city,
      tipo: results.type,
      pagina: String(results.page),
      hotel_pagina: String(target),
    });
    if (staySearch.entrada && staySearch.saida) {
      params.set("entrada", staySearch.entrada);
      params.set("saida", staySearch.saida);
    }
    if (staySearch.pessoas !== "1") params.set("pessoas", staySearch.pessoas);
    return "/hospedagens?" + params.toString() + "#reservas-hub";
  };
  return (
    <>
      <Header />
      <LocalizedTree>
        <main id="conteudo" tabIndex={-1} className={"provider-page provider-" + category}>
          <section className="provider-hero">
            <div className="container provider-hero-inner">
              <div>
                <p className="eyebrow">HUB. {info.label.toLocaleUpperCase("pt-BR")}</p>
                <h1>{info.title}</h1>
                <p>{info.description}</p>
                <span className="provider-hero-note">
                  <MapPin size={16} aria-hidden="true" />
                  Todo o Amazonas, com Maués e região em destaque.
                </span>
              </div>
              <div className="provider-hero-symbol" aria-hidden="true">
                <Icon size={96} strokeWidth={1} />
                <span>AMAZONAS</span>
              </div>
            </div>
          </section>
          <div className="container">
            <ProviderSearchArea
              category={category}
              results={results}
              staySearch={staySearch}
              today={today}
              directoryUrl={directoryUrl}
            />
            {category === "hospedagens" && (
              <LodgingHighlights city={results.city} query={results.q} type={results.type} />
            )}
            {category === "hospedagens" && hotelResults?.total && (
              <BookableHotels
                results={hotelResults}
                staySearch={staySearch}
                pageUrl={hotelPageUrl}
                roomsPreparingLabel={t("directory.roomsPreparing")}
                priceLabel={(price) => t("directory.fromNightPrice", { price })}
              />
            )}
            <ProviderResults
              category={category}
              results={results}
              label={info.label}
              Icon={Icon}
              pageUrl={pageUrl}
            />
          </div>
        </main>
      </LocalizedTree>
      <Footer photoCredit={false} />
    </>
  );
}
