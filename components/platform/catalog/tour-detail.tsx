import Link from "next/link";
import { notFound } from "next/navigation";
import { Compass, MapPin, Clock } from "lucide-react";
import { Header, Footer } from "@/components/site/navigation";
import { getDatabase } from "@/db";
import { getSession } from "@/server/admin";
import { publicTour } from "@/server/catalog-service";
import { displayTime, money } from "@/lib/platform-schema/format";
import { PageIntro, PortalNotice } from "../shared";
import { BookingForm } from "../booking-form";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/messages";

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
