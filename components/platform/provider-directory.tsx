import Link from "next/link";
import Image from "next/image";
import {
  BedDouble,
  UtensilsCrossed,
  Compass,
  BriefcaseBusiness,
  Sparkles,
  Ship,
  MapPin,
  Phone,
  Mail,
  Globe,
  ArrowUpRight,
  Search,
  ArrowRight,
  CalendarDays,
  UsersRound,
} from "lucide-react";
import { notFound } from "next/navigation";
import { Header, Footer } from "@/components/site/navigation";
import { getDatabase } from "@/db";
import { publicHotels } from "@/server/catalog-service";
import type { CatalogCategory, CatalogItem } from "@/lib/catalog-content";
import {
  regionCities,
  searchProviders,
  publicProvider,
  providerSource,
  fromHub,
  type DirectoryCategory,
  type DirectorySearch,
  type PublicProvider,
} from "@/server/cadastur/public-directory";
import { displayPublicPhone } from "@/lib/public-contacts";
import {
  companyActivityLabels,
  companyDisplayName,
  money,
  todayInManaus,
} from "@/lib/platform-schema";
import { normalizeStaySearch, staySearchQuery } from "@/lib/stay-search";
import { lodgingHighlights } from "@/lib/lodging-highlights";
import { CatalogCard } from "./shared";
import { NearbyRecommendations } from "./nearby-recommendations";
import { TravelSearchPanel } from "./travel-search";
import "./provider-directory.css";

const modules = {
  hospedagens: {
    label: "Hospedagens",
    title: "Encontre seu lugar na Amazônia.",
    description: "Hotéis e pousadas para descansar entre uma descoberta e outra.",
    icon: BedDouble,
  },
  gastronomia: {
    label: "Gastronomia",
    title: "Sabores que contam histórias.",
    description: "Restaurantes, bares e cafeterias para conhecer o Amazonas à mesa.",
    icon: UtensilsCrossed,
  },
  guias: {
    label: "Guias de turismo",
    title: "Conheça o Amazonas com quem é daqui.",
    description: "Encontre profissionais, confira os idiomas e planeje seu roteiro.",
    icon: Compass,
  },
  agencias: {
    label: "Agências de turismo",
    title: "Sua próxima viagem começa aqui.",
    description: "Agências para organizar passeios, pacotes e novas experiências.",
    icon: BriefcaseBusiness,
  },
  servicos: {
    label: "Serviços turísticos",
    title: "Cada detalhe da sua viagem.",
    description: "Encontre prestadores especializados em experiências e serviços turísticos.",
    icon: Sparkles,
  },
  passeios: {
    label: "Experiências",
    title: "Experiências para descobrir o Amazonas.",
    description: "Encontre atividades locais, roteiros e serviços para viver a região.",
    icon: Compass,
  },
  navegacao: {
    label: "Navegação",
    title: "Caminhos que conectam a Amazônia.",
    description: "Conheça operadores, serviços e informações para seguir pelos rios.",
    icon: Ship,
  },
} as const;
function Contacts({
  entry,
}: {
  entry: Pick<PublicProvider, "phone" | "email" | "address" | "website">;
}) {
  return (
    <div className="provider-contacts">
      {entry.phone ? (
        <a href={"tel:" + entry.phone}>
          <Phone size={15} aria-hidden="true" />
          <span>{displayPublicPhone(entry.phone)}</span>
        </a>
      ) : (
        <span>
          <Phone size={15} aria-hidden="true" />
          Telefone não informado
        </span>
      )}
      {entry.email ? (
        <a href={"mailto:" + entry.email}>
          <Mail size={15} aria-hidden="true" />
          <span>{entry.email}</span>
        </a>
      ) : (
        <span>
          <Mail size={15} aria-hidden="true" />
          E-mail não informado
        </span>
      )}
      <span>
        <MapPin size={15} aria-hidden="true" />
        <span>{entry.address || "Endereço não informado"}</span>
      </span>
      {entry.website && (
        <a href={entry.website} target="_blank" rel="noopener noreferrer">
          <Globe size={15} aria-hidden="true" />
          <span>Visitar site</span>
          <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      )}
    </div>
  );
}
export function ProviderCard({ entry }: { entry: PublicProvider }) {
  const category = entry.category as CatalogCategory;
  const Icon = modules[category].icon;
  return (
    <article className="provider-card">
      <div className="provider-card-top">
        <span className="provider-icon">
          <Icon size={24} aria-hidden="true" />
        </span>
        <span>
          {entry.city} · {entry.uf}
        </span>
      </div>
      {entry.images[0] && (
        <Image
          unoptimized
          className="provider-card-photo"
          src={entry.images[0]}
          alt={`Imagem de ${entry.name}`}
          width={1280}
          height={720}
          sizes="(max-width: 700px) 100vw, (max-width: 1200px) 50vw, 33vw"
          loading="lazy"
        />
      )}
      <h2>
        <Link href={"/prestadores/" + entry.id}>{entry.name}</Link>
      </h2>
      <p className="provider-subtype">{entry.subtype || modules[category].label}</p>
      {entry.summary && <p className="provider-card-summary">{entry.summary}</p>}
      <Contacts entry={entry} />
      <div className="provider-card-bottom">
        <span>
          {category === "hospedagens"
            ? "Diárias sob consulta"
            : category === "agencias"
              ? "Pacotes sob consulta"
              : entry.editorial
                ? "Conteúdo Hub"
                : "Conheça o prestador"}
        </span>
        <Link href={"/prestadores/" + entry.id} aria-label={"Ver detalhes de " + entry.name}>
          <ArrowUpRight size={21} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
export function HubContentGrid({ items, title }: { items: CatalogItem[]; title: string }) {
  if (!items.length) return null;
  return (
    <section className="provider-results hub-content-results" aria-label={title}>
      <div className="provider-section-heading">
        <div>
          <p className="eyebrow">CONTEÚDO DA HUB</p>
          <h2>{title}</h2>
        </div>
        <span>
          {items.length} {items.length === 1 ? "apresentação" : "apresentações"}
        </span>
      </div>
      <div className="provider-grid">
        {items.map((item) => (
          <ProviderCard key={item.id} entry={fromHub(item)} />
        ))}
      </div>
    </section>
  );
}
function ProviderAttribution({
  category,
  includesHub = false,
}: {
  category: DirectoryCategory;
  includesHub?: boolean;
}) {
  return (
    <div className="provider-attribution">
      <span>
        Dados do{" "}
        <a href={providerSource(category)} target="_blank" rel="noreferrer">
          Cadastur · Ministério do Turismo
        </a>{" "}
        sob a licença{" "}
        <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">
          ODbL 1.0
        </a>
        .{includesHub && " Conteúdos adicionais são mantidos pela Hub."}
      </span>
      <a href={"/api/diretorio?categoria=" + category}>Dados abertos (JSON)</a>
    </div>
  );
}
function LodgingHighlights({ city, query, type }: { city: string; query: string; type: string }) {
  const fold = (s: string) =>
    s
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
          <p className="eyebrow">PARA PLANEJAR SUA ESTADIA</p>
          <h2 id="lodging-highlights-title">Hospedagens em Maués e região</h2>
        </div>
        <span>Informações dos hotéis</span>
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
                "Diária sob consulta"
              ) : (
                <>
                  <small>A partir de</small>R$ {item.price},00 <span>/ noite</span>
                </>
              )}
            </strong>
            <p className="lodging-terms">{item.terms}</p>
            <Contacts entry={{ ...item, website: "" }} />
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
export function ProviderDirectory({
  category,
  search = {},
}: {
  category: DirectoryCategory;
  search?: DirectorySearch;
}) {
  const db = getDatabase();
  const results = searchProviders(db, category, search);
  const staySearch = normalizeStaySearch(search);
  const info = modules[category];
  const Icon = info.icon;
  const hotels =
    category === "hospedagens"
      ? publicHotels(db, results.q).filter((hotel) => !results.city || hotel.city === results.city)
      : [];
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
    return `/${category}?${params.toString()}`;
  };
  const pageUrl = (page: number) => `${directoryUrl(page)}#resultados`;
  return (
    <>
      <Header />
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
          <section className="provider-search-area" aria-label="Encontre um prestador">
            {category === "hospedagens" && (
              <TravelSearchPanel active="hospedagens">
                <form className="travel-search-form" role="search" action="/hospedagens">
                  <label className="travel-search-field">
                    <MapPin size={21} aria-hidden="true" />
                    <span>Destino</span>
                    <select name="cidade" defaultValue={results.city}>
                      <option value="">Todo o Amazonas</option>
                      {results.cities.map((city) => (
                        <option key={city}>{city}</option>
                      ))}
                      {results.city && !results.cities.includes(results.city) && (
                        <option>{results.city}</option>
                      )}
                    </select>
                  </label>
                  <div className="travel-search-dates">
                    <label className="travel-search-field">
                      <CalendarDays size={21} aria-hidden="true" />
                      <span>Chegada</span>
                      <input
                        type="date"
                        name="entrada"
                        min={todayInManaus()}
                        defaultValue={staySearch.entrada}
                        aria-label="Data de chegada"
                      />
                    </label>
                    <label className="travel-search-field">
                      <CalendarDays size={21} aria-hidden="true" />
                      <span>Saída</span>
                      <input
                        type="date"
                        name="saida"
                        min={staySearch.entrada || todayInManaus()}
                        defaultValue={staySearch.saida}
                        aria-label="Data de saída"
                      />
                    </label>
                  </div>
                  <label className="travel-search-field">
                    <UsersRound size={21} aria-hidden="true" />
                    <span>Pessoas</span>
                    <select name="pessoas" defaultValue={staySearch.pessoas}>
                      {Array.from({ length: 20 }, (_, index) => index + 1).map((count) => (
                        <option key={count} value={count}>
                          {count} {count === 1 ? "pessoa" : "pessoas"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="travel-search-submit" type="submit">
                    Buscar <Search size={18} aria-hidden="true" />
                  </button>
                  <details
                    className="travel-search-advanced"
                    open={Boolean(results.q || results.type)}
                  >
                    <summary>Mais filtros</summary>
                    <div className="travel-search-advanced-fields">
                      <label>
                        Nome ou palavra-chave
                        <input
                          name="q"
                          defaultValue={results.q}
                          maxLength={100}
                          placeholder="Ex.: pousada, hotel ou cidade"
                        />
                      </label>
                      <label>
                        Tipo de hospedagem
                        <select name="tipo" defaultValue={results.type}>
                          <option value="">Todos os tipos</option>
                          {results.types.map((type) => (
                            <option key={type}>{type}</option>
                          ))}
                          {results.type && !results.types.includes(results.type) && (
                            <option>{results.type}</option>
                          )}
                        </select>
                      </label>
                    </div>
                  </details>
                </form>
                <p className="travel-search-note">
                  As datas e o número de pessoas seguem para os pedidos de hospedagens da Hub. A
                  disponibilidade é confirmada pelo estabelecimento.
                </p>
              </TravelSearchPanel>
            )}
            {category !== "hospedagens" && (
              <form className="provider-search" role="search" action={"/" + category}>
                <label>
                  <span>O que você procura?</span>
                  <div>
                    <Search size={18} aria-hidden="true" />
                    <input
                      name="q"
                      defaultValue={results.q}
                      maxLength={100}
                      placeholder="Nome, cidade ou tipo de serviço"
                    />
                  </div>
                </label>
                <label>
                  <span>Município</span>
                  <select name="cidade" defaultValue={results.city}>
                    <option value="">Todo o Amazonas</option>
                    {results.cities.map((city) => (
                      <option key={city}>{city}</option>
                    ))}
                    {results.city && !results.cities.includes(results.city) && (
                      <option>{results.city}</option>
                    )}
                  </select>
                </label>
                <button className="button button-dark" type="submit">
                  Buscar <ArrowRight size={17} aria-hidden="true" />
                </button>
              </form>
            )}
            <div className="provider-city-links">
              <span>Explore a região:</span>
              {regionCities.map((city) => (
                <Link
                  key={city}
                  href={directoryUrl(undefined, city)}
                  aria-current={city === results.city ? "page" : undefined}
                >
                  {city}
                </Link>
              ))}
              {(results.city ||
                results.q ||
                results.type ||
                staySearch.entrada ||
                staySearch.pessoas !== "1") && <Link href={"/" + category}>Limpar filtros</Link>}
            </div>
          </section>
          {category === "hospedagens" && (
            <LodgingHighlights city={results.city} query={results.q} type={results.type} />
          )}
          {!!hotels.length && (
            <section className="provider-bookable">
              <h2>Reserve pela Hub</h2>
              <div className="catalog-grid">
                {hotels.map((hotel) => (
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
                      hotel.from_price === null
                        ? "Quartos em preparação"
                        : "A partir de " + money(hotel.from_price) + " / noite"
                    }
                  />
                ))}
              </div>
            </section>
          )}
          <section
            id="resultados"
            className="provider-results"
            aria-labelledby="provider-results-title"
          >
            <div className="provider-section-heading">
              <div>
                <p className="eyebrow">EXPLORE O AMAZONAS</p>
                <h2 id="provider-results-title">{results.city || info.label}</h2>
              </div>
              <span>
                {results.total.toLocaleString("pt-BR")}{" "}
                {results.total === 1 ? "cadastro" : "cadastros"}
                {results.q && " · “" + results.q + "”"}
                {results.type && " · " + results.type}
              </span>
            </div>
            {results.entries.length ? (
              <div className="provider-grid">
                {results.entries.map((entry) => (
                  <ProviderCard key={entry.id} entry={entry} />
                ))}
              </div>
            ) : (
              <div className="provider-empty">
                <Icon size={36} aria-hidden="true" />
                <h3>Nenhum cadastro encontrado.</h3>
                <p>Experimente outro nome ou município.</p>
                <Link className="text-link" href={"/" + category}>
                  Ver todos no Amazonas
                </Link>
              </div>
            )}
            {results.pages > 1 && (
              <nav className="provider-pagination" aria-label="Páginas de prestadores">
                {results.page > 1 ? (
                  <Link href={pageUrl(results.page - 1)}>← Anterior</Link>
                ) : (
                  <span />
                )}
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
          {results.entries.some((entry) => entry.source === "cadastur") && (
            <ProviderAttribution
              category={category}
              includesHub={results.entries.some((entry) => entry.editorial)}
            />
          )}
        </div>
      </main>
      <Footer photoCredit={false} />
    </>
  );
}
export function ProviderDetail({ id }: { id: string }) {
  const entry = publicProvider(getDatabase(), id);
  if (!entry) notFound();
  const category = entry.category;
  const directoryHref =
    category === "guias"
      ? "/experiencias?tipo=guia"
      : category === "passeios"
        ? "/experiencias?tipo=atividade"
        : "/" + category;
  const info = modules[category],
    Icon = info.icon;
  return (
    <>
      <Header />
      <main
        id="conteudo"
        tabIndex={-1}
        className={"provider-page provider-detail provider-" + category}
      >
        <div className="container">
          <Link href={directoryHref} className="text-link">
            ← {info.label}
          </Link>
          <div className="provider-detail-layout">
            <section>
              <div className="provider-detail-art">
                {entry.images[0] ? (
                  <Image
                    unoptimized
                    src={entry.images[0]}
                    alt={`Imagem de ${entry.name}`}
                    width={1600}
                    height={1100}
                    sizes="(max-width: 800px) 100vw, 66vw"
                  />
                ) : (
                  <Icon size={82} strokeWidth={1} aria-hidden="true" />
                )}
                <span>{info.label} · Amazonas</span>
              </div>
              <p className="eyebrow">
                {entry.city} · {entry.uf}
              </p>
              <h1>{entry.name}</h1>
              <p>{entry.subtype || info.label}</p>
              {entry.summary && <p className="provider-detail-summary">{entry.summary}</p>}
              {entry.description && <p className="preserve-lines">{entry.description}</p>}
              {entry.details && (
                <section className="provider-extra-details" aria-label="Informações adicionais">
                  <h2>Mais informações</h2>
                  <p className="preserve-lines">{entry.details}</p>
                </section>
              )}
              {entry.images.length > 1 && (
                <div className="provider-detail-gallery" aria-label="Outras imagens">
                  {entry.images.slice(1).map((image, index) => (
                    <Image
                      unoptimized
                      key={image}
                      src={image}
                      alt={`Imagem ${index + 2} de ${entry.name}`}
                      width={640}
                      height={480}
                      sizes="(max-width: 600px) 33vw, 20vw"
                      loading="lazy"
                    />
                  ))}
                </div>
              )}
              {category === "guias" && entry.languages && (
                <dl className="provider-facts">
                  <div>
                    <dt>Idiomas de atendimento</dt>
                    <dd>{entry.languages}</dd>
                  </div>
                </dl>
              )}
            </section>
            <aside className="provider-contact-panel">
              <p className="eyebrow">PLANEJE SUA VISITA</p>
              <h2>Fale com {category === "guias" ? "o profissional" : "o estabelecimento"}</h2>
              <Contacts entry={entry} />
              {entry.phone && (
                <a className="button button-dark" href={"tel:" + entry.phone}>
                  Ligar agora <Phone size={17} aria-hidden="true" />
                </a>
              )}
              {entry.website && (
                <a
                  className="button button-outline"
                  href={entry.website}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Acessar site <ArrowUpRight size={17} aria-hidden="true" />
                </a>
              )}
              {(category === "hospedagens" || category === "agencias") && (
                <p>
                  {category === "hospedagens"
                    ? "Consulte diárias, quartos e disponibilidade para sua viagem."
                    : "Consulte roteiros, pacotes e valores para suas datas."}
                </p>
              )}
            </aside>
          </div>
          {category === "hospedagens" && entry.source === "cadastur" && (
            <NearbyRecommendations providerId={entry.id} source="cadastur" />
          )}
          {entry.source === "cadastur" ? (
            <ProviderAttribution
              category={category as DirectoryCategory}
              includesHub={entry.editorial}
            />
          ) : (
            <p className="provider-hub-credit">
              Conteúdo enviado e mantido pela equipe da Hub Amazonas.
            </p>
          )}
        </div>
      </main>
      <Footer photoCredit={false} />
    </>
  );
}
