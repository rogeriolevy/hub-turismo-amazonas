import Link from "next/link";
import type { StaySearchValues } from "@/lib/stay-search";
import { companyActivityLabels, companyDisplayName } from "@/lib/platform-schema/company";
import { money } from "@/lib/platform-schema/format";
import { staySearchQuery } from "@/lib/stay-search";
import { searchPublicHotels } from "@/server/catalog-service";
import { CatalogCard } from "../shared";

type BookableHotelResults = NonNullable<Awaited<ReturnType<typeof searchPublicHotels>>>;

export function BookableHotels({
  results,
  staySearch,
  pageUrl,
  roomsPreparingLabel,
  priceLabel,
}: {
  results: BookableHotelResults;
  staySearch: StaySearchValues;
  pageUrl: (page: number) => string;
  roomsPreparingLabel: string;
  priceLabel: (price: string) => string;
}) {
  if (!results.total) return null;
  return (
    <section className="provider-bookable" id="reservas-hub">
      <div className="provider-section-heading">
        <h2>Reserve pela Hub</h2>
        <span>{results.total.toLocaleString("pt-BR")} hospedagens</span>
      </div>
      <div className="catalog-grid">
        {results.hotels.map((hotel) => (
          <CatalogCard
            key={hotel.id}
            kind="hotel"
            href={
              "/hospedagens/" +
              hotel.slug +
              (staySearch.entrada || staySearch.pessoas !== "1"
                ? "?" + staySearchQuery(staySearch)
                : "")
            }
            title={companyDisplayName(hotel)}
            city={hotel.city}
            subtype={companyActivityLabels[hotel.activity_type]}
            description={hotel.description}
            price={
              hotel.from_price === null ? roomsPreparingLabel : priceLabel(money(hotel.from_price))
            }
          />
        ))}
      </div>
      {results.pages > 1 && (
        <nav className="provider-pagination" aria-label="Páginas de hospedagens para reserva">
          {results.page > 1 ? <Link href={pageUrl(results.page - 1)}>← Anterior</Link> : <span />}
          <span>
            Página {results.page} de {results.pages}
          </span>
          {results.page < results.pages ? (
            <Link href={pageUrl(results.page + 1)}>Próxima →</Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </section>
  );
}
