"use client";

import Link from "next/link";
import { catalogCategories, type CatalogCategory } from "@/lib/catalog-content";
import { cadasturSources, type CadasturCategory } from "@/lib/cadastur-schema";
import { LocalizedEmptyState } from "../shared-views";
import type { Locale } from "@/lib/i18n/messages";
import { PlatformOptionSelect } from "../platform-option-select";
import { api, post } from "./api";
import type { CadasturDirectoryState } from "./types";

type Props = {
  category: CadasturCategory;
  directory: CadasturDirectoryState;
  locale: Locale;
  search: string;
  setSearch: (value: string) => void;
  busy: string;
  run: (label: string, task: () => Promise<void>) => Promise<void>;
  refresh: (category?: CadasturCategory, page?: number, query?: string) => Promise<void>;
  setSuccess: (message: string) => void;
};

export function CadasturDirectoryManagement({
  category,
  directory,
  locale,
  search,
  setSearch,
  busy,
  run,
  refresh,
  setSuccess,
}: Props) {
  return (
    <section className="cadastur-directory" aria-labelledby="cadastur-directory">
      <h2 id="cadastur-directory">Diretório interno · {cadasturSources[category].label}</h2>
      <form
        className="cadastur-search"
        onSubmit={(event) => {
          event.preventDefault();
          void run("Buscando registros…", () => refresh());
        }}
      >
        <label>
          Buscar por nome ou município
          <input
            maxLength={100}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <button className="button button-outline" disabled={!!busy}>
          Buscar
        </button>
      </form>
      <p>{directory.total.toLocaleString("pt-BR")} registros importados.</p>
      {!directory.entries.length ? (
        <LocalizedEmptyState locale={locale} title="Nenhum registro para mostrar.">
          <p>
            Importe uma fonte oficial ou ajuste a busca. Os cadastros operacionais da Hub continuam
            no menu Empresas.
          </p>
        </LocalizedEmptyState>
      ) : (
        <div className="editor-list">
          {directory.entries.map((entry) => (
            <details className="editor-card" key={entry.id}>
              <summary>
                <span>
                  {entry.name}
                  <small>
                    {entry.city} / {entry.uf} · {entry.period}
                  </small>
                </span>
                <span className="status-pill">
                  {entry.review_status === "reviewed" ? "Revisado" : "A revisar"}
                </span>
              </summary>
              <p>
                {entry.subtype || "Tipo não informado"} · Situação na fonte:{" "}
                {entry.registry_status || "Não informada"}
              </p>
              <p>
                Certificado / CNPJ: {entry.external_id}
                {entry.valid_until && " · Validade: " + entry.valid_until}
              </p>
              <p>
                {[entry.phone, entry.email, entry.address, entry.website]
                  .filter(Boolean)
                  .join(" · ") || "Contatos não informados na fonte."}
              </p>
              {catalogCategories.includes(entry.category as CatalogCategory) && (
                <p>
                  <Link
                    className="button button-outline"
                    href={`/painel/plataforma/conteudos?categoria=${entry.category}&cadastur=${encodeURIComponent(entry.id)}`}
                  >
                    Completar perfil com informações e imagens
                  </Link>
                </p>
              )}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void run("Salvando revisão…", async () => {
                    await api(
                      "revisar",
                      post({
                        id: entry.id,
                        company_id: form.get("company_id") || null,
                        guide_id: form.get("guide_id") || null,
                        published: form.get("published") === "on",
                      }),
                    );
                    await refresh(category, directory.page);
                    setSuccess(
                      "Revisão salva. O vínculo não altera contas, permissões ou ofertas.",
                    );
                  });
                }}
              >
                <fieldset className="cadastur-fields" disabled={!!busy}>
                  <label>
                    <input name="published" type="checkbox" defaultChecked={!!entry.published} />
                    Exibir no diretório público com os contatos comerciais disponíveis
                  </label>
                  {entry.category === "hospedagens" && (
                    <PlatformOptionSelect
                      id={`cadastur-company-${entry.id}`}
                      name="company_id"
                      label="Vincular a hospedagem existente (opcional)"
                      initialValue={entry.company_id || ""}
                      initialLabel={entry.company_name || undefined}
                      emptyOptionLabel="Sem vínculo"
                      entity="company"
                      companyKind="hotel"
                      disabled={!!busy}
                    />
                  )}
                  {entry.category === "guias" && (
                    <PlatformOptionSelect
                      id={`cadastur-guide-${entry.id}`}
                      name="guide_id"
                      label="Vincular a perfil de guia existente (opcional)"
                      initialValue={entry.guide_id || ""}
                      initialLabel={entry.guide_name || undefined}
                      emptyOptionLabel="Sem vínculo"
                      entity="guide"
                      disabled={!!busy}
                    />
                  )}
                  <button className="button button-outline" type="submit">
                    Salvar revisão
                  </button>
                </fieldset>
              </form>
            </details>
          ))}
        </div>
      )}
      {directory.total > 20 && (
        <nav className="cadastur-pagination" aria-label="Paginação do diretório">
          <button
            className="button button-outline"
            disabled={!!busy || directory.page <= 1}
            onClick={() =>
              void run("Carregando página…", () => refresh(category, directory.page - 1))
            }
          >
            Anterior
          </button>
          <span>
            Página {directory.page} de {Math.ceil(directory.total / 20)}
          </span>
          <button
            className="button button-outline"
            disabled={!!busy || directory.page * 20 >= directory.total}
            onClick={() =>
              void run("Carregando página…", () => refresh(category, directory.page + 1))
            }
          >
            Próxima
          </button>
        </nav>
      )}
      {!!directory.history.length && (
        <details className="editor-card">
          <summary>Últimas importações confirmadas</summary>
          <ul>
            {directory.history.map((item) => (
              <li key={item.id}>
                {item.period} ·{" "}
                {new Date(item.created_at).toLocaleString("pt-BR", {
                  timeZone: "America/Manaus",
                })}
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="cadastur-footnote">
        Fonte: Ministério do Turismo / Cadastur. Os dados representam o período informado; não
        confirmam a situação atual nem parceria com a Hub. Licença ODbL 1.0.
      </p>
    </section>
  );
}
