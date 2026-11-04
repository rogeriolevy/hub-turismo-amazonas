import { BedDouble, ArrowUpRight } from "lucide-react";
import { lodgingHighlights } from "@/lib/lodging-highlights";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/messages";
import { ProviderContacts } from "./provider-card";

export async function LodgingHighlights({
  city,
  query,
  type,
}: {
  city: string;
  query: string;
  type: string;
}) {
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const fold = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const highlights = lodgingHighlights.filter(
    (item) =>
      (!city || fold(item.city) === fold(city)) &&
      (!query || fold(item.name + " " + item.city).includes(fold(query))) &&
      (!type || fold(item.subtype) === fold(type)),
  );
  if (!highlights.length) return null;
  return (
    <section className="lodging-highlights" aria-labelledby="lodging-highlights-title">
      <div className="provider-section-heading">
        <div>
          <p className="eyebrow">{t("directory.planStay")}</p>
          <h2 id="lodging-highlights-title">{t("directory.stayInMaués")}</h2>
        </div>
        <span>{t("directory.hotelInfo")}</span>
      </div>
      <div className="lodging-highlight-grid">
        {highlights.map((item) => (
          <article key={item.name} className="lodging-highlight">
            <div className="lodging-highlight-heading">
              <BedDouble size={28} aria-hidden="true" />
              <span>{item.city} · AM</span>
            </div>
            <h3>{item.name}</h3>
            <p>{item.description}</p>
            <strong className="lodging-rate">
              {item.price === null ? (
                t("directory.dailyOnRequest")
              ) : (
                <>
                  <small>{t("directory.from")}</small>R$ {item.price},00{" "}
                  <span>{t("directory.night")}</span>
                </>
              )}
            </strong>
            <p className="lodging-terms">{item.terms}</p>
            <ProviderContacts entry={{ ...item, website: "" }} />
            <div className="lodging-source">
              <a href={item.source} target="_blank" rel="noopener noreferrer">
                {item.sourceLabel} <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
