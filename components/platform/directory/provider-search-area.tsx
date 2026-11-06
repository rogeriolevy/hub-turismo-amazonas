import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Search, UsersRound } from "lucide-react";
import { regionCities, type DirectoryCategory } from "@/server/cadastur/public-directory";
import type { StaySearchValues } from "@/lib/stay-search";
import { LocalizedTree } from "@/lib/i18n/localized-tree";
import { TravelSearchPanel } from "../travel-search";

type SearchResults = {
  city: string;
  cities: string[];
  q: string;
  type: string;
  types: string[];
};

type Props = {
  category: DirectoryCategory;
  results: SearchResults;
  staySearch: StaySearchValues;
  today: string;
  directoryUrl: (page?: number, city?: string) => string;
};

export async function ProviderSearchArea({
  category,
  results,
  staySearch,
  today,
  directoryUrl,
}: Props) {
  return (
    <LocalizedTree>
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
                    min={today}
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
                    min={staySearch.entrada || today}
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
              <details className="travel-search-advanced" open={Boolean(results.q || results.type)}>
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
    </LocalizedTree>
  );
}
