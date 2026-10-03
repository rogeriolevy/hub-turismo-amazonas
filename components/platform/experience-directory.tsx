import Link from "next/link";
import { ArrowRight, ArrowUpRight, Compass, MapPin, Search } from "lucide-react";
import { Header, Footer } from "@/components/site/navigation";
import { getDatabase } from "@/db";
import { normalizeLabel } from "@/lib/cadastur-schema";
import { money } from "@/lib/platform-schema";
import { publicCatalogItems } from "@/server/catalog-content-service";
import { publicGuides, publicTours } from "@/server/catalog-service";
import {
  fromHub,
  publicProviders,
  regionCities,
  type DirectorySearch,
  type PublicProvider,
} from "@/server/cadastur/public-directory";
import { CatalogCard, EmptyState } from "./shared";
import { ProviderCard } from "./provider-directory";
import "./provider-directory.css";
import "./experience-directory.css";

type CompanyGuide = ReturnType<typeof publicGuides>[number];
type PublicTour = ReturnType<typeof publicTours>[number];
type ExperienceResult =
  | {
      key: string;
      kind: "tour";
      name: string;
      city: string;
      searchable: string;
      tour: PublicTour;
    }
  | {
      key: string;
      kind: "activity";
      name: string;
      city: string;
      searchable: string;
      provider: PublicProvider;
    }
  | {
      key: string;
      kind: "provider";
      name: string;
      city: string;
      searchable: string;
      provider: PublicProvider;
    }
  | {
      key: string;
      kind: "guide";
      name: string;
      city: string;
      searchable: string;
      guide: CompanyGuide;
    };

function firstValue(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 100) ?? "";
}

function GuideCard({ guide }: { guide: CompanyGuide }) {
  return (
    <article className="provider-card experience-guide-card">
      <div className="provider-card-top">
        <span className="provider-icon">
          <Compass size={24} aria-hidden="true" />
        </span>
        <span>{guide.city} · AM</span>
      </div>
      <p className="provider-subtype">
        Guia de turismo{guide.languages ? ` · ${guide.languages}` : ""}
      </p>
      <h2>
        <Link href={`/guias/${guide.slug}`}>{guide.name}</Link>
      </h2>
      <p className="provider-card-summary">
        {guide.bio || `Profissional de turismo da equipe ${guide.company_name}.`}
      </p>
      <div className="provider-card-bottom">
        <span>{guide.company_name}</span>
        <Link href={`/guias/${guide.slug}`} aria-label={`Conhecer ${guide.name}`}>
          <ArrowUpRight size={21} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

function ExperienceResultCard({ result }: { result: ExperienceResult }) {
  if (result.kind === "tour")
    return (
      <CatalogCard
        kind="tour"
        href={`/passeios/${result.tour.slug}`}
        title={result.tour.name}
        city={result.tour.city}
        subtype="Passeio ou roteiro"
        description={result.tour.description}
        price={`${money(result.tour.price_cents)} / pessoa`}
      />
    );
  if (result.kind === "guide") return <GuideCard guide={result.guide} />;
  return <ProviderCard entry={result.provider} />;
}

export function ExperienceDirectory({ search = {} }: { search?: DirectorySearch }) {
  const db = getDatabase();
  const q = firstValue(search.q);
  const city = firstValue(search.cidade);
  const requestedType = firstValue(search.tipo);
  const requestedPage = firstValue(search.pagina);
  const all: ExperienceResult[] = [
    ...publicTours(db).map((tour) => ({
      key: `tour:${tour.id}`,
      kind: "tour" as const,
      name: tour.name,
      city: tour.city,
      searchable: `${tour.name} ${tour.city} ${tour.description} ${tour.company_name}`,
      tour,
    })),
    ...publicCatalogItems(db, "passeios").map((item) => {
      const provider = fromHub(item);
      return {
        key: `activity:${item.id}`,
        kind: "activity" as const,
        name: item.name,
        city: item.city,
        searchable: `${item.name} ${item.city} ${item.subtype} ${item.summary} ${item.description} ${item.details}`,
        provider,
      };
    }),
    ...publicProviders(db, "guias").map((provider) => ({
      key: `provider:${provider.id}`,
      kind: "provider" as const,
      name: provider.name,
      city: provider.city,
      searchable: `${provider.name} ${provider.city} ${provider.subtype} ${provider.summary} ${provider.description} ${provider.details} ${provider.languages}`,
      provider,
    })),
    ...publicGuides(db).map((guide) => ({
      key: `guide:${guide.id}`,
      kind: "guide" as const,
      name: guide.name,
      city: guide.city,
      searchable: `${guide.name} ${guide.city} ${guide.languages} ${guide.bio} ${guide.company_name}`,
      guide,
    })),
  ];
  const cities = [
    ...new Set([...regionCities, ...all.map((item) => item.city).filter(Boolean)]),
  ].sort((a, b) => {
    const aPriority = regionCities.findIndex((name) => normalizeLabel(name) === normalizeLabel(a));
    const bPriority = regionCities.findIndex((name) => normalizeLabel(name) === normalizeLabel(b));
    return (
      (aPriority < 0 ? 99 : aPriority) - (bPriority < 0 ? 99 : bPriority) ||
      a.localeCompare(b, "pt-BR")
    );
  });
  const type = requestedType === "guia" || requestedType === "atividade" ? requestedType : "";
  const results = all
    .filter((item) => {
      const isGuide = item.kind === "guide" || item.kind === "provider";
      return (
        (!type || (type === "guia" ? isGuide : !isGuide)) &&
        (!city || normalizeLabel(city) === normalizeLabel(item.city)) &&
        (!q || normalizeLabel(item.searchable).includes(normalizeLabel(q)))
      );
    })
    .sort((a, b) => {
      const aPriority = regionCities.findIndex(
        (name) => normalizeLabel(name) === normalizeLabel(a.city),
      );
      const bPriority = regionCities.findIndex(
        (name) => normalizeLabel(name) === normalizeLabel(b.city),
      );
      return (
        (aPriority < 0 ? 99 : aPriority) - (bPriority < 0 ? 99 : bPriority) ||
        a.name.localeCompare(b.name, "pt-BR")
      );
    });
  const pages = Math.max(1, Math.ceil(results.length / 24));
  const page = Math.max(
    1,
    Math.min(pages, /^\d{1,6}$/.test(requestedPage) ? Number(requestedPage) : 1),
  );
  const visibleResults = results.slice((page - 1) * 24, page * 24);
  const pageHref = (target: number) => {
    const params = new URLSearchParams({ q, cidade: city, tipo: type, pagina: String(target) });
    return `/experiencias?${params.toString()}#resultados`;
  };

  return (
    <>
      <Header />
      <main id="conteudo" tabIndex={-1} className="provider-page provider-experiencias">
        <section className="provider-hero">
          <div className="container provider-hero-inner">
            <div>
              <p className="eyebrow">HUB. EXPERIÊNCIAS</p>
              <h1>Descubra o Amazonas com quem vive a região.</h1>
              <p>
                Encontre passeios, roteiros e guias de turismo em um só lugar. Consulte os detalhes
                de cada experiência antes de planejar sua viagem.
              </p>
              <span className="provider-hero-note">
                <MapPin size={16} aria-hidden="true" />
                Todo o Amazonas, com Maués e região em destaque.
              </span>
            </div>
            <div className="provider-hero-symbol" aria-hidden="true">
              <Compass size={96} strokeWidth={1} />
              <span>AMAZONAS</span>
            </div>
          </div>
        </section>
        <div className="container">
          <section className="provider-search-area" aria-label="Buscar experiências">
            <form
              className="provider-search experience-search"
              role="search"
              action="/experiencias"
            >
              <label>
                <span>O que você procura?</span>
                <div>
                  <Search size={18} aria-hidden="true" />
                  <input
                    name="q"
                    defaultValue={q}
                    maxLength={100}
                    placeholder="Passeio, guia, cidade ou palavra-chave"
                  />
                </div>
              </label>
              <label>
                <span>Município</span>
                <select name="cidade" defaultValue={city}>
                  <option value="">Todo o Amazonas</option>
                  {cities.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Tipo de experiência</span>
                <select name="tipo" defaultValue={type}>
                  <option value="">Todas as experiências</option>
                  <option value="atividade">Passeios e roteiros</option>
                  <option value="guia">Guias de turismo</option>
                </select>
              </label>
              <button className="button button-dark" type="submit">
                Buscar <ArrowRight size={17} aria-hidden="true" />
              </button>
            </form>
            <div className="provider-city-links">
              <span>Explore a região:</span>
              {regionCities.map((name) => (
                <Link
                  key={name}
                  href={`/experiencias?${new URLSearchParams({ q, tipo: type, cidade: name })}`}
                  aria-current={normalizeLabel(name) === normalizeLabel(city) ? "page" : undefined}
                >
                  {name}
                </Link>
              ))}
              {(q || city || type) && <Link href="/experiencias">Limpar filtros</Link>}
            </div>
          </section>
          <section
            className="provider-results experience-results"
            id="resultados"
            aria-labelledby="experience-results-title"
          >
            <div className="provider-section-heading">
              <div>
                <p className="eyebrow">EXPLORE O AMAZONAS</p>
                <h2 id="experience-results-title">{city || "Experiências turísticas"}</h2>
              </div>
              <span>
                {results.length.toLocaleString("pt-BR")}{" "}
                {results.length === 1 ? "resultado" : "resultados"}
                {q && ` · “${q}”`}
                {type === "guia" && " · Guias de turismo"}
                {type === "atividade" && " · Passeios e roteiros"}
              </span>
            </div>
            {results.length ? (
              <div className="provider-grid experience-grid">
                {visibleResults.map((result) => (
                  <ExperienceResultCard key={result.key} result={result} />
                ))}
              </div>
            ) : (
              <EmptyState title="Nenhuma experiência encontrada.">
                <p>Tente outra palavra, município ou tipo de experiência.</p>
                <Link className="text-link" href="/experiencias">
                  Ver todas as experiências
                </Link>
              </EmptyState>
            )}
            {pages > 1 && (
              <nav className="provider-pagination" aria-label="Páginas de experiências">
                {page > 1 ? <Link href={pageHref(page - 1)}>← Anterior</Link> : <span />}
                <span>
                  Página {page} de {pages} · {results.length.toLocaleString("pt-BR")} resultados
                </span>
                {page < pages ? <Link href={pageHref(page + 1)}>Próxima →</Link> : <span />}
              </nav>
            )}
          </section>
          {results.some(
            (item) => item.kind === "provider" && item.provider.source === "cadastur",
          ) && (
            <p className="provider-attribution">
              <span>
                Perfis de guias incluem dados do Cadastur · Ministério do Turismo, sob a licença{" "}
                <a
                  href="https://opendatacommons.org/licenses/odbl/1-0/"
                  target="_blank"
                  rel="noreferrer"
                >
                  ODbL 1.0
                </a>
                . Conteúdos adicionais são mantidos pela Hub.
              </span>
              <a href="/api/diretorio?categoria=guias">Dados do Cadastur (JSON)</a>
            </p>
          )}
        </div>
      </main>
      <Footer photoCredit={false} />
    </>
  );
}
