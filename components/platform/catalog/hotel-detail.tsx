import Link from "next/link";
import { notFound } from "next/navigation";
import { BedDouble } from "lucide-react";
import { Header, Footer } from "@/components/site/navigation";
import { getDatabase } from "@/db";
import { getSession } from "@/server/admin";
import { publicHotel } from "@/server/catalog-service";
import { companyActivityLabels, companyDisplayName } from "@/lib/platform-schema/company";
import { money } from "@/lib/platform-schema/format";
import { staySearchQuery, type StaySearchValues } from "@/lib/stay-search";
import { PageIntro, PortalNotice } from "../shared";
import { BookingForm } from "../booking-form";
import { NearbyRecommendations } from "../nearby-recommendations";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/messages";

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
