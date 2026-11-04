import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { searchProviders, type DirectoryCategory } from "@/server/cadastur/public-directory";
import { ProviderAttribution } from "./provider-attribution";
import { ProviderCard } from "./provider-card";

type ProviderResultsData = Awaited<ReturnType<typeof searchProviders>>;

export function ProviderResults({
  category,
  results,
  label,
  Icon,
  pageUrl,
}: {
  category: DirectoryCategory;
  results: ProviderResultsData;
  label: string;
  Icon: LucideIcon;
  pageUrl: (page: number) => string;
}) {
  return (
    <>
      <section
        id="resultados"
        className="provider-results"
        aria-labelledby="provider-results-title"
      >
        <div className="provider-section-heading">
          <div>
            <p className="eyebrow">EXPLORE O AMAZONAS</p>
            <h2 id="provider-results-title">{results.city || label}</h2>
          </div>
          <span>
            {results.total.toLocaleString("pt-BR")} {results.total === 1 ? "cadastro" : "cadastros"}
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
      {results.entries.some((entry) => entry.source === "cadastur") && (
        <ProviderAttribution
          category={category}
          includesHub={results.entries.some((entry) => entry.editorial)}
        />
      )}
    </>
  );
}
