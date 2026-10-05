import Link from "next/link";
import { notFound } from "next/navigation";
import { BedDouble, Compass, MapPin, Clock, Languages } from "lucide-react";
import { Header, Footer } from "@/components/site/navigation";
import { getDatabase } from "@/db";
import { getSession } from "@/server/admin";
import { publicCatalogItems } from "@/server/catalog-content-service";
import { normalizeLabel } from "@/lib/cadastur-schema";
import {
  publicHotels,
  publicHotel,
  publicTours,
  publicTour,
  publicGuide,
} from "@/server/catalog-service";
import {
  companyActivityLabels,
  money,
  displayTime,
  companyDisplayName,
} from "@/lib/platform-schema";
import { staySearchQuery, type StaySearchValues } from "@/lib/stay-search";
import { CatalogCard, EmptyState, PageIntro, PortalNotice } from "./shared";
import { BookingForm } from "./booking-form";
import { NearbyRecommendations } from "./nearby-recommendations";
import { HubContentGrid } from "./provider-directory";
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
          normalizeLabel(`${item.name} ${item.city} ${item.subtype} ${item.summary}`).includes(
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
export async function HotelDetail({
  slug,
  search = { entrada: "", saida: "", pessoas: "1" },
}: {
  slug: string;
  search?: StaySearchValues;
}) {
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) =>
    translate(locale, key, values);
  const hotel = await publicHotel(getDatabase(), slug);
  if (!hotel) notFound();
  const session = await getSession();
  const hasSearchIntent = Boolean(search.entrada || search.pessoas !== "1");
  const returnTo =
    "/hospedagens/" + hotel.slug + (hasSearchIntent ? "?" + staySearchQuery(search) : "");
  return (
    <>
      <Header />
      <main id="conteudo" tabIndex={-1} className="portal-main">
        <div className="container">
          <Link className="text-link" href="/hospedagens">
            {t("catalog.allStays")}
          </Link>
          <PageIntro
            eyebrow={companyActivityLabels[hotel.activity_type].toLocaleUpperCase("pt-BR")}
            title={companyDisplayName(hotel)}
            description={hotel.city}
          />
          <div className="detail-layout">
            <div>
              <div className="detail-art hotel">
                <BedDouble size={72} />
                <span>{t("catalog.stayTagline")}</span>
              </div>
              <h2 className="subheading">{t("catalog.aboutStay")}</h2>
              <p className="preserve-lines">{hotel.description}</p>
              <h2 className="subheading">{t("catalog.rooms")}</h2>
              <div className="resource-list">
                {hotel.rooms.map((room) => (
                  <article key={room.id}>
                    <div>
                      <h3>{room.name}</h3>
                      <p>{t("catalog.roomInfo", { code: room.code, capacity: room.capacity })}</p>
                    </div>
                    <strong>
                      {money(room.price_cents)}
                      <small>{t("catalog.perNight")}</small>
                    </strong>
                  </article>
                ))}
              </div>
              <PortalNotice>{t("catalog.bookingDisclaimer")}</PortalNotice>
            </div>
            <BookingForm
              kind="hotel"
              returnTo={returnTo}
              authenticated={!!session}
              initialStay={search}
              options={hotel.rooms.map((room) => ({
                value: room.id,
                label: room.name + " · " + room.code + " · " + money(room.price_cents) + "/noite",
              }))}
            />
          </div>
          <NearbyRecommendations providerId={hotel.id} source="company" />
        </div>
      </main>
      <Footer />
    </>
  );
}
export async function TourDetail({ slug }: { slug: string }) {
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) =>
    translate(locale, key, values);
  const tour = await publicTour(getDatabase(), slug);
  if (!tour) notFound();
  const session = await getSession();
  return (
    <>
      <Header />
      <main id="conteudo" tabIndex={-1} className="portal-main">
        <div className="container">
          <Link className="text-link" href="/experiencias">
            {t("catalog.allExperiences")}
          </Link>
          <PageIntro
            eyebrow={t("catalog.experienceEyebrow")}
            title={tour.name}
            description={tour.city}
          />
          <div className="detail-layout">
            <div>
              <div className="detail-art tour">
                <Compass size={72} />
                <span>{t("catalog.experienceTagline")}</span>
              </div>
              <div className="detail-facts">
                <span>
                  <MapPin size={18} />
                  {tour.city}
                </span>
                <span>
                  <Clock size={18} />
                  {tour.duration_minutes} {t("catalog.minutes")}
                </span>
                <strong>
                  {money(tour.price_cents)} {t("catalog.perPerson")}
                </strong>
              </div>
              <h2 className="subheading">{t("catalog.yourExperience")}</h2>
              <p className="preserve-lines">{tour.description}</p>
              <PortalNotice>
                {t("catalog.organizedBy", { company: tour.company_name })}
              </PortalNotice>
              {tour.guide && (
                <Link className="guide-card" href={"/guias/" + tour.guide.slug}>
                  <span className="avatar">{tour.guide.name.slice(0, 1)}</span>
                  <span>
                    <small>{t("catalog.meetGuide")}</small>
                    <strong>{tour.guide.name}</strong>
                  </span>
                  <span>→</span>
                </Link>
              )}
            </div>
            <BookingForm
              kind="tour"
              returnTo={"/passeios/" + tour.slug}
              authenticated={!!session}
              options={tour.departures
                .filter((d) => d.capacity - (d.reserved || 0) > 0)
                .map((d) => ({
                  value: d.id,
                  label:
                    displayTime(d.starts_at) + " · " + (d.capacity - (d.reserved || 0)) + " vagas",
                }))}
            />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
export async function GuideDetail({ slug }: { slug: string }) {
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const guide = await publicGuide(getDatabase(), slug);
  if (!guide) notFound();
  return (
    <>
      <Header />
      <main id="conteudo" tabIndex={-1} className="portal-main">
        <div className="container">
          <Link className="text-link" href="/experiencias?tipo=guia">
            {t("catalog.guidesAndExperiences")}
          </Link>
          <PageIntro
            eyebrow={t("catalog.guide")}
            title={guide.name}
            description={guide.city + " · " + guide.company_name}
          />
          <div className="guide-profile">
            <span className="avatar large">{guide.name.slice(0, 1)}</span>
            <div>
              <p className="preserve-lines">{guide.bio}</p>
              <p className="detail-facts">
                <Languages size={20} />
                {guide.languages}
              </p>
            </div>
          </div>
          <h2 className="subheading">{t("catalog.experiencesWithGuide")}</h2>
          {guide.tours.length ? (
            <div className="catalog-grid">
              {guide.tours.map((tour) => (
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
          ) : (
            <EmptyState title={t("catalog.newExperiences")}>
              <p>{t("catalog.guideToursWillAppear")}</p>
            </EmptyState>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
