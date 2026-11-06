"use client";

import type { FormEvent } from "react";
import type { Inspection, SourceResource } from "@/lib/cadastur-schema";

export type CadasturSourceMode = "official" | "file" | "paste";

type Props = {
  mode: CadasturSourceMode;
  setMode: (mode: CadasturSourceMode) => void;
  resources: SourceResource[];
  resource: string;
  setResource: (value: string) => void;
  setPeriod: (value: string) => void;
  setFile: (value: File | null) => void;
  csv: string;
  setCsv: (value: string) => void;
  inspection: Inspection | null;
  sheet: string;
  onSheetChange: (value: string) => void;
  busy: string;
  reset: () => void;
  run: (label: string, task: () => Promise<void>) => Promise<void>;
  onInspect: (event: FormEvent) => void;
  onLookupSources: () => Promise<void>;
};

export function CadasturSourceStep({
  mode,
  setMode,
  resources,
  resource,
  setResource,
  setPeriod,
  setFile,
  csv,
  setCsv,
  inspection,
  sheet,
  onSheetChange,
  busy,
  reset,
  run,
  onInspect,
  onLookupSources,
}: Props) {
  return (
    <section className="editor-card cadastur-card" aria-labelledby="cadastur-source">
      <h2 id="cadastur-source">1. Escolha a fonte</h2>
      <form onSubmit={onInspect}>
        <fieldset disabled={!!busy} className="cadastur-fields">
          <label>
            Origem
            <select
              value={mode}
              onChange={(event) => {
                setMode(event.target.value as CadasturSourceMode);
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
                onClick={() => void run("Consultando arquivos oficiais…", onLookupSources)}
              >
                Consultar arquivos do MTur
              </button>
              <label>
                Arquivo / período
                <select
                  required
                  value={resource}
                  onChange={(event) => {
                    setResource(event.target.value);
                    setPeriod(
                      resources.find((item) => item.id === event.target.value)?.period || "",
                    );
                    reset();
                  }}
                >
                  <option value="">Selecione um arquivo</option>
                  {resources.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.format.toUpperCase()}
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
                onChange={(event) => {
                  setFile(event.target.files?.[0] || null);
                  reset();
                }}
              />
              <small>
                Até 20 MB. Arquivos XLS devem ser salvos como XLSX. A primeira linha precisa conter
                os nomes das colunas.
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
                onChange={(event) => {
                  setCsv(event.target.value);
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
                onChange={(event) => {
                  onSheetChange(event.target.value);
                }}
              >
                {inspection.sheets.map((item) => (
                  <option value={item.name} key={item.name}>
                    {item.name} · {item.rows.toLocaleString("pt-BR")} linhas
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
  );
}
