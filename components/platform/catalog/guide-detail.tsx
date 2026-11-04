import Link from "next/link";
import { notFound } from "next/navigation";
import { Languages } from "lucide-react";
import { Header, Footer } from "@/components/site/navigation";
import { getDatabase } from "@/db";
import { publicGuide } from "@/server/catalog-service";
import { money } from "@/lib/platform-schema/format";
import { CatalogCard, EmptyState, PageIntro } from "../shared";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/messages";

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
