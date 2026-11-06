import Link from "next/link";
import { ArrowUpRight, FilePlus2, ImagePlus, Search } from "lucide-react";
import {
  catalogCategories,
  catalogCategoryLabels,
  type CatalogCategory,
  type CatalogItem,
  type CatalogSourceEntry,
} from "@/lib/catalog-content";
import { CatalogContentForm } from "./catalog-content-form";
import { PaginationNavigation } from "./pagination-navigation";
import "./catalog-content.css";

export function CatalogContentPanel({
  category,
  items,
  sourceEntry,
  sourceItem,
  counts,
  page,
  totalPages,
}: {
  category: CatalogCategory;
  items: CatalogItem[];
  sourceEntry?: CatalogSourceEntry;
  sourceItem: CatalogItem | null;
  counts: Record<CatalogCategory, { total: number; published: number }>;
  page: number;
  totalPages: number;
}) {
  const selectedItems = items;
  const additionalItems = selectedItems.filter((item) => item.id !== sourceItem?.id);
  const selectedCount = counts[category];

  return (
    <div className="catalog-content-panel">
      <div className="catalog-content-intro">
        <div>
          <p className="eyebrow">CONTEÚDO DO SITE</p>
          <h1>Cadastros dos módulos</h1>
          <p>
            Crie e atualize apresentações da Hub, publique informações úteis e mantenha contatos e
            imagens em um só lugar.
          </p>
        </div>
        <Link className="catalog-cadastur-link" href="/painel/plataforma/cadastur">
          <Search size={16} aria-hidden="true" />
          Revisar registros do Cadastur <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </div>

      <nav className="catalog-category-tabs" aria-label="Módulos do catálogo">
        {catalogCategories.map((value) => (
          <Link
            key={value}
            href={`/painel/plataforma/conteudos?categoria=${value}`}
            aria-current={value === category ? "page" : undefined}
          >
            {catalogCategoryLabels[value]}
            <span>{counts[value].total}</span>
          </Link>
        ))}
      </nav>

      <section className="catalog-content-summary" aria-label="Resumo do módulo selecionado">
        <div>
          <span>Cadastros no módulo</span>
          <strong>{selectedCount.total}</strong>
        </div>
        <div>
          <span>Visíveis no site</span>
          <strong>{selectedCount.published}</strong>
        </div>
        <div>
          <span>Em rascunho</span>
          <strong>{selectedCount.total - selectedCount.published}</strong>
        </div>
      </section>

      {sourceEntry && (
        <section
          className="editor-card catalog-content-create"
          aria-labelledby="catalog-source-heading"
        >
          <h2 id="catalog-source-heading">
            {sourceItem ? "Complemento do Cadastur" : "Completar perfil do Cadastur"}
          </h2>
          <p>
            {sourceEntry.name} · {sourceEntry.city}. As informações oficiais permanecem vinculadas
            ao Cadastur; este formulário adiciona apresentação, detalhes e imagens da Hub Amazonas.
          </p>
          <CatalogContentForm
            category={category}
            item={sourceItem ?? undefined}
            sourceEntry={sourceEntry}
          />
        </section>
      )}

      <details
        className="editor-card catalog-content-create"
        open={!sourceEntry && !selectedCount.total}
      >
        <summary>
          <span>
            <FilePlus2 size={17} aria-hidden="true" />
            Cadastrar em {catalogCategoryLabels[category].toLocaleLowerCase("pt-BR")}
          </span>
        </summary>
        <CatalogContentForm category={category} />
      </details>

      <section className="catalog-content-list" aria-labelledby="catalog-content-list-title">
        <div className="catalog-content-list-heading">
          <div>
            <p className="eyebrow">GERENCIAMENTO</p>
            <h2 id="catalog-content-list-title">{catalogCategoryLabels[category]}</h2>
          </div>
          <span>{selectedCount.total} cadastro(s)</span>
        </div>
        {additionalItems.length ? (
          <div className="editor-list">
            {additionalItems.map((item) => (
              <details className="editor-card" key={item.id}>
                <summary>
                  <span>
                    {item.name}
                    <small>
                      {item.city}
                      {item.subtype ? " · " + item.subtype : ""}
                    </small>
                  </span>
                  <span className={`status-pill ${item.status}`}>
                    {item.status === "published" ? "Publicado" : "Rascunho"}
                  </span>
                </summary>
                <div className="catalog-content-editor-heading">
                  <span>
                    <ImagePlus size={15} aria-hidden="true" />
                    Edite informações, contatos e imagens. A exclusão remove este conteúdo Hub;
                    registros oficiais são gerenciados no Cadastur.
                  </span>
                </div>
                <CatalogContentForm category={category} item={item} />
              </details>
            ))}
          </div>
        ) : sourceItem ? null : (
          <div className="catalog-content-empty">
            <ImagePlus size={23} aria-hidden="true" />
            <p>Ainda não há conteúdo cadastrado neste módulo.</p>
            <span>Use o formulário acima para adicionar a primeira apresentação da Hub.</span>
          </div>
        )}
        <PaginationNavigation
          page={page}
          totalPages={totalPages}
          hrefForPage={(nextPage) =>
            `/painel/plataforma/conteudos?categoria=${category}&page=${nextPage}${sourceEntry ? `&cadastur=${encodeURIComponent(sourceEntry.id)}` : ""}`
          }
        />
      </section>
    </div>
  );
}
