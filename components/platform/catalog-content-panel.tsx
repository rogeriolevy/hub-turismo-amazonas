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
import "./catalog-content.css";

export function CatalogContentPanel({
  category,
  items,
  sourceEntry,
}: {
  category: CatalogCategory;
  items: CatalogItem[];
  sourceEntry?: CatalogSourceEntry;
}) {
  const selectedItems = items.filter((item) => item.category === category);
  const sourceItem = sourceEntry
    ? selectedItems.find((item) => item.source_entry_id === sourceEntry.id)
    : undefined;
  const additionalItems = selectedItems.filter((item) => item.id !== sourceItem?.id);
  const countByCategory = new Map(
    catalogCategories.map((value) => [
      value,
      items.filter((item) => item.category === value).length,
    ]),
  );
  const published = selectedItems.filter((item) => item.status === "published").length;

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
            <span>{countByCategory.get(value) || 0}</span>
          </Link>
        ))}
      </nav>

      <section className="catalog-content-summary" aria-label="Resumo do módulo selecionado">
        <div>
          <span>Cadastros no módulo</span>
          <strong>{selectedItems.length}</strong>
        </div>
        <div>
          <span>Visíveis no site</span>
          <strong>{published}</strong>
        </div>
        <div>
          <span>Em rascunho</span>
          <strong>{selectedItems.length - published}</strong>
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
          <CatalogContentForm category={category} item={sourceItem} sourceEntry={sourceEntry} />
        </section>
      )}

      <details
        className="editor-card catalog-content-create"
        open={!sourceEntry && !selectedItems.length}
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
          <span>{selectedItems.length} cadastro(s)</span>
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
      </section>
    </div>
  );
}
