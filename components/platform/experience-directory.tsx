import Link from "next/link";
import { ArrowRight, ArrowUpRight, Compass, MapPin, Search } from "lucide-react";
import { Header, Footer } from "@/components/site/navigation";
import { getDatabase } from "@/db";
import { normalizeLabel } from "@/lib/cadastur-schema";
import { money } from "@/lib/platform-schema/format";
import { regionCities, type DirectorySearch } from "@/server/cadastur/public-directory";
import { searchExperiences, type ExperienceResult } from "@/server/experience-directory-service";
import { CatalogCard, EmptyState } from "./shared";
import { ProviderCard } from "./directory/provider-card";
import { LocalizedTree } from "@/lib/i18n/localized-tree";
import "./provider-directory.css";
import "./experience-directory.css";

function GuideCard({ guide }: { guide: Extract<ExperienceResult, { kind: "guide" }>["guide"] }) {
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

export async function ExperienceDirectory({ search = {} }: { search?: DirectorySearch }) {
  const db = getDatabase();
  const { q, city, type, page, pages, results, total, cities, hasCadasturProviders } =
    await searchExperiences(db, search);
  const pageHref = (target: number) => {
    const params = new URLSearchParams({ q, cidade: city, tipo: type, pagina: String(target) });
    return `/experiencias?${params.toString()}#resultados`;
  };

  return (
    <>
      <Header />
      <LocalizedTree>
        <main id="conteudo" tabIndex={-1} className="provider-page provider-experiencias">
          <section className="provider-hero">
            <div className="container provider-hero-inner">
              <div>
                <p className="eyebrow">HUB. EXPERIÊNCIAS</p>
                <h1>Descubra o Amazonas com quem vive a região.</h1>
                <p>
                  Encontre passeios, roteiros e guias de turismo em um só lugar. Consulte os
                  detalhes de cada experiência antes de planejar sua viagem.
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
                    aria-current={
                      normalizeLabel(name) === normalizeLabel(city) ? "page" : undefined
                    }
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
                  {total.toLocaleString("pt-BR")} {total === 1 ? "resultado" : "resultados"}
                  {q && ` · “${q}”`}
                  {type === "guia" && " · Guias de turismo"}
                  {type === "atividade" && " · Passeios e roteiros"}
                </span>
              </div>
              {results.length ? (
                <div className="provider-grid experience-grid">
                  {results.map((result) => (
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
                    Página {page} de {pages} · {total.toLocaleString("pt-BR")} resultados
                  </span>
                  {page < pages ? <Link href={pageHref(page + 1)}>Próxima →</Link> : <span />}
                </nav>
              )}
            </section>
            {hasCadasturProviders && (
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
      </LocalizedTree>
      <Footer photoCredit={false} />
    </>
  );
}
