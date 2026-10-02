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
import { money, displayTime, companyDisplayName } from "@/lib/platform-schema";
import { CatalogCard, EmptyState, PageIntro, PortalNotice } from "./shared";
import { BookingForm } from "./booking-form";
import { NearbyRecommendations } from "./nearby-recommendations";
import { HubContentGrid } from "./provider-directory";
export function Directory({ kind, query }: { kind: "hotel" | "tour"; query: string }) {
  const db = getDatabase();
  const hotels = kind === "hotel" ? publicHotels(db, query) : [];
  const tours = kind === "tour" ? publicTours(db, query) : [];
  const experiences =
    kind === "tour"
      ? publicCatalogItems(db, "passeios").filter((item) =>
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
            eyebrow={kind === "hotel" ? "HUB. HOSPEDAGEM" : "HUB. PASSEIOS"}
            title={
              kind === "hotel"
                ? "Seu próximo lugar na Amazônia."
                : "Histórias que começam pelo caminho."
            }
            description={
              kind === "hotel"
                ? "Encontre hospedagens e envie sua solicitação diretamente à equipe responsável."
                : "Conheça passeios, guias e saídas disponíveis. Escolha sua experiência e aguarde a aprovação do operador."
            }
          />
          <form className="catalog-search" role="search">
            <label className="sr-only" htmlFor="catalog-search">
              Buscar por nome ou cidade
            </label>
            <input
              id="catalog-search"
              name="q"
              placeholder="Busque pelo nome ou pela cidade"
              defaultValue={query}
              maxLength={100}
            />
            <button className="button button-dark">Buscar</button>
            {query && (
              <Link href={kind === "hotel" ? "/hospedagens" : "/passeios"} className="text-link">
                Limpar
              </Link>
            )}
          </form>
          <div className="catalog-count">
            <span>
              {hotels.length + tours.length + experiences.length}{" "}
              {kind === "hotel" ? "hospedagem(ns)" : "experiência(s)"}
            </span>
            <span>Solicitação online · Aprovação pelo responsável</span>
          </div>
          {!hotels.length && !tours.length && !experiences.length ? (
            <EmptyState
              title={query ? "Nenhum resultado por aqui." : "Estamos preparando novas conexões."}
            >
              <p>
                {query
                  ? "Experimente outro nome ou cidade."
                  : "Os parceiros publicados pela administração aparecerão neste espaço. Ainda não há ofertas cadastradas."}
              </p>
              <Link className="text-link" href="/#contato">
                Converse com a Hub
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
                <HubContentGrid items={experiences} title="Atividades e roteiros da Hub" />
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
export async function HotelDetail({ slug }: { slug: string }) {
  const hotel = publicHotel(getDatabase(), slug);
  if (!hotel) notFound();
  const session = await getSession();
  return (
    <>
      <Header />
      <main id="conteudo" tabIndex={-1} className="portal-main">
        <div className="container">
          <Link className="text-link" href="/hospedagens">
            ← Todas as hospedagens
          </Link>
          <PageIntro
            eyebrow="HOSPEDAGEM"
            title={companyDisplayName(hotel)}
            description={hotel.city}
          />
          <div className="detail-layout">
            <div>
              <div className="detail-art hotel">
                <BedDouble size={72} />
                <span>Encontre seu tempo de ficar.</span>
              </div>
              <h2 className="subheading">Sobre a hospedagem</h2>
              <p className="preserve-lines">{hotel.description}</p>
              <h2 className="subheading">Quartos</h2>
              <div className="resource-list">
                {hotel.rooms.map((room) => (
                  <article key={room.id}>
                    <div>
                      <h3>{room.name}</h3>
                      <p>
                        Quarto {room.code} · Até {room.capacity} pessoas
                      </p>
                    </div>
                    <strong>
                      {money(room.price_cents)}
                      <small>por noite / quarto</small>
                    </strong>
                  </article>
                ))}
              </div>
              <PortalNotice>
                Uma solicitação não garante a reserva. A equipe confirmará a disponibilidade antes
                de aprovar. O valor considera as diárias informadas no momento da solicitação.
              </PortalNotice>
            </div>
            <BookingForm
              kind="hotel"
              returnTo={"/hospedagens/" + hotel.slug}
              authenticated={!!session}
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
  const tour = publicTour(getDatabase(), slug);
  if (!tour) notFound();
  const session = await getSession();
  return (
    <>
      <Header />
      <main id="conteudo" tabIndex={-1} className="portal-main">
        <div className="container">
          <Link className="text-link" href="/passeios">
            ← Todos os passeios
          </Link>
          <PageIntro eyebrow="EXPERIÊNCIA AMAZÔNICA" title={tour.name} description={tour.city} />
          <div className="detail-layout">
            <div>
              <div className="detail-art tour">
                <Compass size={72} />
                <span>Cada caminho, uma nova história.</span>
              </div>
              <div className="detail-facts">
                <span>
                  <MapPin size={18} />
                  {tour.city}
                </span>
                <span>
                  <Clock size={18} />
                  {tour.duration_minutes} minutos
                </span>
                <strong>{money(tour.price_cents)} por pessoa</strong>
              </div>
              <h2 className="subheading">Sua experiência</h2>
              <p className="preserve-lines">{tour.description}</p>
              <PortalNotice>
                Organização: {tour.company_name}. Horários apresentados no fuso de Manaus.
              </PortalNotice>
              {tour.guide && (
                <Link className="guide-card" href={"/guias/" + tour.guide.slug}>
                  <span className="avatar">{tour.guide.name.slice(0, 1)}</span>
                  <span>
                    <small>Conheça quem acompanha</small>
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
export function GuideDetail({ slug }: { slug: string }) {
  const guide = publicGuide(getDatabase(), slug);
  if (!guide) notFound();
  return (
    <>
      <Header />
      <main id="conteudo" tabIndex={-1} className="portal-main">
        <div className="container">
          <Link className="text-link" href="/passeios">
            ← Passeios e guias
          </Link>
          <PageIntro
            eyebrow="GUIA LOCAL"
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
          <h2 className="subheading">Experiências com este guia</h2>
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
            <EmptyState title="Novas experiências a caminho.">
              <p>Os passeios deste guia serão apresentados aqui.</p>
            </EmptyState>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
