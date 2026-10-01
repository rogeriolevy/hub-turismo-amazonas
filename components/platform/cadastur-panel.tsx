"use client";
import { useState, type FormEvent } from "react";
import {
  cadasturSources,
  fieldLabels,
  importOptionsSchema,
  isAllowedMappingColumn,
  states,
  MAX_FILE_BYTES,
  type CadasturCategory,
  type ColumnMapping,
  type Inspection,
  type Preview,
  type SourceResource,
  type RegistryEntry,
  type ImportHistory,
  type MappingField,
} from "@/lib/cadastur-schema";
import { PageIntro, EmptyState, PortalNotice } from "./shared";

type Directory = {
  entries: RegistryEntry[];
  total: number;
  page: number;
  history: ImportHistory[];
};
type Props = {
  initial: Directory;
  companies: { id: string; name: string }[];
  guides: { id: string; name: string }[];
};
const actions: Record<string, string> = {
  added: "Incluir",
  updated: "Atualizar",
  unchanged: "Sem alteração",
};
async function api<T>(action: string, init?: RequestInit): Promise<T> {
  const response = await fetch("/api/cadastur/" + action, init);
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error?.message || "Não foi possível concluir. Tente novamente.");
  return result.data;
}
const post = (data: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(data),
});
export function CadasturPanel({ initial, companies, guides }: Props) {
  const [category, setCategory] = useState<CadasturCategory>("hospedagens");
  const [mode, setMode] = useState("official"),
    [resources, setResources] = useState<SourceResource[]>([]),
    [resource, setResource] = useState("");
  const [file, setFile] = useState<File | null>(null),
    [csv, setCsv] = useState("");
  const [period, setPeriod] = useState(""),
    [uf, setUf] = useState("AM"),
    [city, setCity] = useState(""),
    [sheet, setSheet] = useState("1");
  const [includeContacts, setIncludeContacts] = useState(true);
  const [inspection, setInspection] = useState<Inspection | null>(null),
    [mapping, setMapping] = useState<ColumnMapping | null>(null),
    [preview, setPreview] = useState<Preview | null>(null);
  const [directory, setDirectory] = useState(initial),
    [search, setSearch] = useState("");
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const reset = () => {
    setInspection(null);
    setMapping(null);
    setPreview(null);
    setSheet("1");
    setSuccess("");
    setError("");
  };
  async function run(label: string, task: () => Promise<void>) {
    setBusy(label);
    setError("");
    setSuccess("");
    try {
      await task();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir.");
    } finally {
      setBusy("");
    }
  }
  async function refresh(nextCategory = category, page = 1, q = search) {
    setDirectory(
      await api<Directory>(
        `registros?category=${nextCategory}&page=${page}&q=${encodeURIComponent(q)}`,
      ),
    );
  }
  function uploadBody(config: unknown): RequestInit {
    if (mode === "official") {
      if (!resource) throw Error("Consulte os arquivos e selecione um período.");
      return post({ ...(config as object), resource_id: resource });
    }
    const selected = mode === "paste" ? new File([csv], "dados.csv", { type: "text/csv" }) : file;
    if (!selected || !selected.size || selected.size > MAX_FILE_BYTES)
      throw Error("Selecione um arquivo CSV/XLSX ou cole um CSV de até 20 MB.");
    if (!/\.(csv|xlsx)$/i.test(selected.name)) throw Error("Use um arquivo CSV ou XLSX.");
    const body = new FormData();
    body.set("file", selected);
    body.set("config", JSON.stringify(config));
    return { method: "POST", body };
  }
  async function inspect(event: FormEvent) {
    event.preventDefault();
    await run("Lendo arquivo…", async () => {
      const result = await api<Inspection & { period: string | null }>(
        "inspecionar",
        uploadBody({ category, sheet }),
      );
      setInspection(result);
      setSheet(result.sheet);
      setMapping(result.mapping);
      setPreview(null);
      if (result.period) setPeriod(result.period);
      setSuccess("Colunas identificadas. Confira o mapeamento e gere a prévia.");
    });
  }
  async function generate(event: FormEvent) {
    event.preventDefault();
    await run("Preparando prévia…", async () => {
      const options = importOptionsSchema.safeParse({
        category,
        period,
        uf,
        city,
        sheet,
        mapping,
        include_contacts: includeContacts,
        checksum: inspection?.checksum,
      });
      if (!options.success)
        throw Error("Informe o período (ex.: 2026-T2), a UF e as quatro colunas obrigatórias.");
      setPreview(await api<Preview>("prever", uploadBody(options.data)));
      setSuccess("Prévia pronta. Confira os registros antes de confirmar.");
    });
  }
  const choices = Object.entries(cadasturSources) as [
    CadasturCategory,
    (typeof cadasturSources)[CadasturCategory],
  ][];
  return (
    <>
      <PageIntro
        eyebrow="DADOS ABERTOS · MINISTÉRIO DO TURISMO"
        title="Cadastur, conectado à sua rede."
        description="Importe referências cadastrais, confira os dados e organize os vínculos com a Hub."
      />
      <PortalNotice>
        Importe os dados e marque os registros que devem aparecer no diretório público. Os contatos
        comerciais são opcionais na importação; contas e ofertas são gerenciadas separadamente.
      </PortalNotice>
      <div className="cadastur-feedback" aria-live="polite" aria-atomic="true">
        {busy && (
          <p role="status">{busy} A leitura de uma planilha nacional pode levar alguns segundos.</p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="cadastur-success" role="status">
            {success}
          </p>
        )}
      </div>
      <fieldset className="cadastur-controls" disabled={!!busy}>
        <label>
          Módulo
          <select
            value={category}
            onChange={(event) => {
              const value = event.target.value as CadasturCategory;
              setCategory(value);
              reset();
              setResources([]);
              setResource("");
              setPeriod("");
              setSearch("");
              setDirectory({ entries: [], total: 0, page: 1, history: [] });
              void run("Carregando diretório…", () => refresh(value, 1, ""));
            }}
          >
            {choices.map(([key, source]) => (
              <option key={key} value={key}>
                {source.label}
              </option>
            ))}
          </select>
        </label>
        <a
          href={`https://dados.turismo.gov.br/pt_BR/dataset/${cadasturSources[category].dataset}`}
          target="_blank"
          rel="noreferrer"
        >
          Ver conjunto oficial ↗
        </a>
      </fieldset>
      <section className="editor-card cadastur-card" aria-labelledby="cadastur-source">
        <h2 id="cadastur-source">1. Escolha a fonte</h2>
        <form onSubmit={inspect}>
          <fieldset disabled={!!busy} className="cadastur-fields">
            <label>
              Origem
              <select
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value);
                  reset();
                  setPeriod("");
                }}
              >
                <option value="official">Buscar no Ministério do Turismo</option>
                <option value="file">Enviar arquivo oficial</option>
                <option value="paste">Colar conteúdo CSV</option>
              </select>
            </label>
            {mode === "official" ? (
              <>
                <button
                  className="button button-outline"
                  type="button"
                  onClick={() =>
                    void run("Consultando arquivos oficiais…", async () => {
                      const rows = await api<SourceResource[]>("fontes?category=" + category);
                      setResources(rows);
                      setResource(rows[0]?.id || "");
                      setPeriod(rows[0]?.period || "");
                      reset();
                      if (!rows.length)
                        throw Error(
                          "Nenhum recurso CSV/XLSX trimestral disponível. Utilize o envio de arquivo.",
                        );
                    })
                  }
                >
                  Consultar arquivos do MTur
                </button>
                <label>
                  Arquivo / período
                  <select
                    required
                    value={resource}
                    onChange={(e) => {
                      setResource(e.target.value);
                      setPeriod(resources.find((r) => r.id === e.target.value)?.period || "");
                      reset();
                    }}
                  >
                    <option value="">Selecione um arquivo</option>
                    {resources.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} · {r.format.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : mode === "file" ? (
              <label>
                Arquivo CSV ou XLSX
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  required
                  onChange={(e) => {
                    setFile(e.target.files?.[0] || null);
                    reset();
                  }}
                />
                <small>
                  Até 20 MB. Arquivos XLS devem ser salvos como XLSX. A primeira linha precisa
                  conter os nomes das colunas.
                </small>
              </label>
            ) : (
              <label>
                Conteúdo CSV
                <textarea
                  rows={5}
                  required
                  maxLength={2000000}
                  value={csv}
                  onChange={(e) => {
                    setCsv(e.target.value);
                    reset();
                  }}
                  placeholder="Certificado;Nome;UF;Município"
                />
                <small>
                  Copie o cabeçalho e os registros do arquivo de origem. Colunas pessoais serão
                  ignoradas.
                </small>
              </label>
            )}
            {inspection && inspection.sheets.length > 1 && (
              <label>
                Aba da planilha
                <select
                  value={sheet}
                  onChange={(e) => {
                    setSheet(e.target.value);
                    setMapping(null);
                    setPreview(null);
                  }}
                >
                  {inspection.sheets.map((s) => (
                    <option value={s.name} key={s.name}>
                      {s.name} · {s.rows.toLocaleString("pt-BR")} linhas
                    </option>
                  ))}
                </select>
                <small>
                  Guias PF e PJ precisam ser importados separadamente. Após trocar de aba, leia as
                  colunas novamente.
                </small>
              </label>
            )}
            <button className="button button-dark" type="submit">
              Ler colunas
            </button>
          </fieldset>
        </form>
      </section>
      {inspection && mapping && (
        <section className="editor-card cadastur-card" aria-labelledby="cadastur-mapping">
          <h2 id="cadastur-mapping">2. Confira as colunas e o recorte</h2>
          <p>
            {inspection.rows.toLocaleString("pt-BR")} linhas na aba{" "}
            <strong>{inspection.sheet}</strong>. A prévia aplicará os filtros abaixo.
          </p>
          <form onSubmit={generate}>
            <fieldset
              disabled={!!busy}
              className="cadastur-fields"
              onChange={() => setPreview(null)}
            >
              <div className="cadastur-grid">
                <label>
                  Período de referência
                  <input
                    required
                    pattern="20[0-9]{2}-T[1-4]"
                    value={period}
                    placeholder="2026-T2"
                    readOnly={mode === "official"}
                    onChange={(e) => setPeriod(e.target.value)}
                  />
                </label>
                <label>
                  UF
                  <select value={uf} onChange={(e) => setUf(e.target.value)}>
                    {states.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Município (opcional)
                  <input
                    value={city}
                    maxLength={100}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Todos os municípios da UF"
                  />
                </label>
              </div>
              <div className="cadastur-grid">
                {Object.entries(fieldLabels).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    {["external_id", "name", "uf", "city"].includes(key) ? " *" : ""}
                    <select
                      value={mapping[key as keyof ColumnMapping]}
                      onChange={(e) => setMapping({ ...mapping, [key]: Number(e.target.value) })}
                    >
                      <option value={-1}>Não importar / selecionar</option>
                      {inspection.headers.map(
                        (header, i) =>
                          isAllowedMappingColumn(key as MappingField, header) && (
                            <option key={i} value={i}>
                              {i + 1}. {header || "Sem título"}
                            </option>
                          ),
                      )}
                    </select>
                  </label>
                ))}
              </div>
              <p>
                O nome fantasia tem prioridade na sugestão. Se estiver vazio, será usado o nome
                alternativo selecionado. Para guias sem nome fantasia, use o nome do profissional.
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={includeContacts}
                  onChange={(e) => setIncludeContacts(e.target.checked)}
                />
                Importar telefone, e-mail, endereço comercial e site divulgados na fonte
              </label>
              <small>
                Campos com * são obrigatórios. Só estes campos selecionados serão mantidos. Não
                mapeie informações pessoais em campos cadastrais.
              </small>
              <button className="button button-dark" type="submit">
                Gerar prévia
              </button>
            </fieldset>
          </form>
        </section>
      )}
      {preview && (
        <section className="editor-card cadastur-card" aria-labelledby="cadastur-preview">
          <h2 id="cadastur-preview">3. Revise antes de importar</h2>
          <p>
            {preview.period} ·{" "}
            {preview.source.verified
              ? "Arquivo obtido diretamente do MTur"
              : "Arquivo fornecido pelo administrador; origem declarada"}{" "}
            · Licença ODbL
          </p>
          <div className="cadastur-metrics">
            {(
              [
                ["added", "Novos"],
                ["updated", "Atualizações"],
                ["unchanged", "Sem alteração"],
                ["duplicates", "Duplicatas"],
                ["filtered", "Fora do recorte"],
                ["invalid", "Inválidos"],
                ["conflicts", "Conflitos"],
                ["older", "Mais antigos"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <strong>{preview.counts[key].toLocaleString("pt-BR")}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          {!!preview.issues.length && (
            <details>
              <summary>
                Ver ocorrências (
                {preview.counts.invalid + preview.counts.conflicts + preview.counts.older}; até 100
                exibidas)
              </summary>
              <ul>
                {preview.issues.map((issue, i) => (
                  <li key={i}>
                    Linha {issue.row}: {issue.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {!!preview.records.length && (
            <div
              className="cadastur-table"
              tabIndex={0}
              role="region"
              aria-label="Amostra da prévia, até 100 registros"
            >
              <table>
                <caption>
                  Até 100 registros da seleção. A confirmação processa todos os registros válidos
                  contados acima.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Prestador</th>
                    <th scope="col">Município</th>
                    <th scope="col">Situação na fonte</th>
                    <th scope="col">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.records.map((record) => (
                    <tr key={record.external_id}>
                      <td>
                        {record.name}
                        <small>{record.subtype || "Tipo não informado"}</small>
                      </td>
                      <td>
                        {record.city} / {record.uf}
                      </td>
                      <td>{record.registry_status || "Não informada"}</td>
                      <td>{actions[record.action]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!preview.records.length && (
            <EmptyState title="Nenhum registro válido neste recorte.">
              <p>Confira as colunas, a aba, a UF e as ocorrências antes de tentar novamente.</p>
            </EmptyState>
          )}
          <p>
            A confirmação grava {preview.counts.added + preview.counts.updated} registros no
            diretório interno. A prévia expira em 30 minutos.
          </p>
          <button
            disabled={!!busy || preview.counts.added + preview.counts.updated === 0}
            className="button button-dark"
            onClick={() =>
              void run("Confirmando importação…", async () => {
                await api("confirmar", post({ id: preview.id }));
                setPreview(null);
                await refresh();
                setSuccess(
                  "Importação concluída. Os registros estão disponíveis para revisão abaixo.",
                );
              })
            }
          >
            Confirmar importação
          </button>
        </section>
      )}
      <section className="cadastur-directory" aria-labelledby="cadastur-directory">
        <h2 id="cadastur-directory">Diretório interno · {cadasturSources[category].label}</h2>
        <form
          className="cadastur-search"
          onSubmit={(e) => {
            e.preventDefault();
            void run("Buscando registros…", () => refresh());
          }}
        >
          <label>
            Buscar por nome ou município
            <input maxLength={100} value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <button className="button button-outline" disabled={!!busy}>
            Buscar
          </button>
        </form>
        <p>{directory.total.toLocaleString("pt-BR")} registros importados.</p>
        {!directory.entries.length ? (
          <EmptyState title="Nenhum registro para mostrar.">
            <p>
              Importe uma fonte oficial ou ajuste a busca. Os cadastros operacionais da Hub
              continuam no menu Empresas.
            </p>
          </EmptyState>
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
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
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
                      <label>
                        Vincular a hospedagem existente (opcional)
                        <select name="company_id" defaultValue={entry.company_id || ""}>
                          <option value="">Sem vínculo</option>
                          {companies.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {entry.category === "guias" && (
                      <label>
                        Vincular a perfil de guia existente (opcional)
                        <select name="guide_id" defaultValue={entry.guide_id || ""}>
                          <option value="">Sem vínculo</option>
                          {guides.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      </label>
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
    </>
  );
}
