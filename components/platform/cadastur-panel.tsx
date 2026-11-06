"use client";
import { useState, type FormEvent } from "react";
import {
  cadasturSources,
  importOptionsSchema,
  MAX_FILE_BYTES,
  type CadasturCategory,
  type ColumnMapping,
  type Inspection,
  type Preview,
  type SourceResource,
} from "@/lib/cadastur-schema";
import { LocalizedPageIntro, LocalizedPortalNotice } from "./shared-views";
import type { Locale } from "@/lib/i18n/messages";
import { LocalizedClientTree } from "@/components/site/localized-client-tree";
import { api, post } from "./cadastur/api";
import { CadasturDirectoryManagement } from "./cadastur/directory-management";
import { CadasturMappingStep } from "./cadastur/mapping-step";
import { CadasturPreviewStep } from "./cadastur/preview-step";
import { CadasturSourceStep, type CadasturSourceMode } from "./cadastur/source-step";
import type { CadasturDirectoryState } from "./cadastur/types";

type Props = {
  initial: CadasturDirectoryState;
  locale: Locale;
};
export function CadasturPanel({ initial, locale }: Props) {
  const [category, setCategory] = useState<CadasturCategory>("hospedagens");
  const [mode, setMode] = useState<CadasturSourceMode>("official"),
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
  const [directory, setDirectory] = useState<CadasturDirectoryState>(initial),
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
      await api<CadasturDirectoryState>(
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
    <LocalizedClientTree>
      <>
        <LocalizedPageIntro
          locale={locale}
          eyebrow="DADOS ABERTOS · MINISTÉRIO DO TURISMO"
          title="Cadastur, conectado à sua rede."
          description="Importe referências cadastrais, confira os dados e organize os vínculos com a Hub."
        />
        <LocalizedPortalNotice locale={locale}>
          Importe os dados e marque os registros que devem aparecer no diretório público. Os
          contatos comerciais são opcionais na importação; contas e ofertas são gerenciadas
          separadamente.
        </LocalizedPortalNotice>
        <div className="cadastur-feedback" aria-live="polite" aria-atomic="true">
          {busy && (
            <p role="status">
              {busy} A leitura de uma planilha nacional pode levar alguns segundos.
            </p>
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
        <CadasturSourceStep
          mode={mode}
          setMode={setMode}
          resources={resources}
          resource={resource}
          setResource={setResource}
          setPeriod={setPeriod}
          setFile={setFile}
          csv={csv}
          setCsv={setCsv}
          inspection={inspection}
          sheet={sheet}
          onSheetChange={(value) => {
            setSheet(value);
            setMapping(null);
            setPreview(null);
          }}
          busy={busy}
          reset={reset}
          run={run}
          onInspect={inspect}
          onLookupSources={async () => {
            const rows = await api<SourceResource[]>("fontes?category=" + category);
            setResources(rows);
            setResource(rows[0]?.id || "");
            setPeriod(rows[0]?.period || "");
            reset();
            if (!rows.length)
              throw Error(
                "Nenhum recurso CSV/XLSX trimestral disponível. Utilize o envio de arquivo.",
              );
          }}
        />{" "}
        {inspection && mapping && (
          <CadasturMappingStep
            inspection={inspection}
            mapping={mapping}
            setMapping={setMapping}
            period={period}
            setPeriod={setPeriod}
            uf={uf}
            setUf={setUf}
            city={city}
            setCity={setCity}
            includeContacts={includeContacts}
            setIncludeContacts={setIncludeContacts}
            mode={mode}
            busy={busy}
            onPreviewInvalidated={() => setPreview(null)}
            onGenerate={generate}
          />
        )}{" "}
        {preview && (
          <CadasturPreviewStep
            preview={preview}
            locale={locale}
            busy={busy}
            onConfirm={() =>
              void run("Confirmando importação…", async () => {
                await api("confirmar", post({ id: preview.id }));
                setPreview(null);
                await refresh();
                setSuccess(
                  "Importação concluída. Os registros estão disponíveis para revisão abaixo.",
                );
              })
            }
          />
        )}{" "}
        <CadasturDirectoryManagement
          category={category}
          directory={directory}
          locale={locale}
          search={search}
          setSearch={setSearch}
          busy={busy}
          run={run}
          refresh={refresh}
          setSuccess={setSuccess}
        />
      </>
    </LocalizedClientTree>
  );
}
