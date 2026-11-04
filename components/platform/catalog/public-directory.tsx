import Link from "next/link";
import { Header, Footer } from "@/components/site/navigation";
import { getDatabase } from "@/db";
import { publicCatalogItems } from "@/server/catalog-content-service";
import { normalizeLabel } from "@/lib/cadastur-schema";
import { publicHotels, publicTours } from "@/server/catalog-service";
import { companyActivityLabels, companyDisplayName } from "@/lib/platform-schema/company";
import { money } from "@/lib/platform-schema/format";
import { CatalogCard, EmptyState, PageIntro } from "../shared";
import { HubContentGrid } from "../directory/provider-card";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/messages";

export async function Directory({ kind, query }: { kind: "hotel" | "tour"; query: string }) {
  const [db, locale] = [getDatabase(), await getLocale()];
  const t = (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) =>
    translate(locale, key, values);
  const [hotels, tours, allExperiences] = await Promise.all([
    kind === "hotel" ? publicHotels(db, query) : [],
    kind === "tour" ? publicTours(db, query) : [],
    kind === "tour" ? publicCatalogItems(db, "passeios") : [],
  ]);
  const experiences =
    kind === "tour"
      ? allExperiences.filter((item) =>
          normalizeLabel([item.name, item.city, item.subtype, item.summary].join(" ")).includes(
            normalizeLabel(query),
          ),
        )
      : [];
  return (
    <>
      <Header />
      <main id="conteudo" tabIndex={-1} className="portal-main">
        <div className="container">
          <PageIntro
            eyebrow={t(kind === "hotel" ? "catalog.hotelEyebrow" : "catalog.tourEyebrow")}
            title={t(kind === "hotel" ? "catalog.hotelTitle" : "catalog.tourTitle")}
            description={t(
              kind === "hotel" ? "catalog.hotelDescription" : "catalog.tourDescription",
            )}
          />
          <form className="catalog-search" role="search">
            <label className="sr-only" htmlFor="catalog-search">
              {t("catalog.searchLabel")}
            </label>
            <input
              id="catalog-search"
              name="q"
              placeholder={t("catalog.searchPlaceholder")}
              defaultValue={query}
              maxLength={100}
            />
            <button className="button button-dark">{t("catalog.search")}</button>
            {query && (
              <Link
                href={kind === "hotel" ? "/hospedagens" : "/experiencias"}
                className="text-link"
              >
                {t("catalog.clear")}
              </Link>
            )}
          </form>
          <div className="catalog-count">
            <span>
              {hotels.length + tours.length + experiences.length}{" "}
              {kind === "hotel" ? t("catalog.stays") : t("catalog.experiences")}
            </span>
            <span>{t("catalog.bookingNote")}</span>
          </div>
          {!hotels.length && !tours.length && !experiences.length ? (
            <EmptyState title={query ? t("catalog.noResults") : t("catalog.comingSoon")}>
              <p>{query ? t("catalog.tryNameOrCity") : t("catalog.notPublished")}</p>
              <Link className="text-link" href="/#contato">
                {t("catalog.contactHub")}
              </Link>
            </EmptyState>
          ) : (
            <>
              {!!(hotels.length || tours.length) && (
                <div className="catalog-grid">
                  {hotels.map((hotel) => (
                    <CatalogCard
                      key={hotel.id}
                      kind="hotel"
                      href={"/hospedagens/" + hotel.slug}
                      title={companyDisplayName(hotel)}
                      city={hotel.city}
                      subtype={companyActivityLabels[hotel.activity_type]}
                      description={hotel.description}
                      price={
                        hotel.from_price === null
                          ? "Quartos em preparação"
                          : "A partir de " + money(hotel.from_price) + " / noite"
                      }
                    />
                  ))}
                  {tours.map((tour) => (
                    <CatalogCard
                      key={tour.id}
                      kind="tour"
                      href={"/passeios/" + tour.slug}
                      title={tour.name}
                      city={tour.city}
                      description={tour.description}
                      price={money(tour.price_cents) + " / pessoa"}
                    />
                  ))}
                </div>
              )}
              {kind === "tour" && (
                <HubContentGrid items={experiences} title={t("catalog.hubActivities")} />
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
