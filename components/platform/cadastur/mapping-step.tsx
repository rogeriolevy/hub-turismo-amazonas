"use client";

import type { FormEvent } from "react";
import {
  fieldLabels,
  isAllowedMappingColumn,
  states,
  type ColumnMapping,
  type Inspection,
  type MappingField,
} from "@/lib/cadastur-schema";

type Props = {
  inspection: Inspection;
  mapping: ColumnMapping;
  setMapping: (mapping: ColumnMapping) => void;
  period: string;
  setPeriod: (period: string) => void;
  uf: string;
  setUf: (uf: string) => void;
  city: string;
  setCity: (city: string) => void;
  includeContacts: boolean;
  setIncludeContacts: (includeContacts: boolean) => void;
  mode: "official" | "file" | "paste";
  busy: string;
  onPreviewInvalidated: () => void;
  onGenerate: (event: FormEvent) => void;
};

export function CadasturMappingStep({
  inspection,
  mapping,
  setMapping,
  period,
  setPeriod,
  uf,
  setUf,
  city,
  setCity,
  includeContacts,
  setIncludeContacts,
  mode,
  busy,
  onPreviewInvalidated,
  onGenerate,
}: Props) {
  return (
    <section className="editor-card cadastur-card" aria-labelledby="cadastur-mapping">
      <h2 id="cadastur-mapping">2. Confira as colunas e o recorte</h2>
      <p>
        {inspection.rows.toLocaleString("pt-BR")} linhas na aba <strong>{inspection.sheet}</strong>.
        A prévia aplicará os filtros abaixo.
      </p>
      <form onSubmit={onGenerate}>
        <fieldset disabled={!!busy} className="cadastur-fields" onChange={onPreviewInvalidated}>
          <div className="cadastur-grid">
            <label>
              Período de referência
              <input
                required
                pattern="20[0-9]{2}-T[1-4]"
                value={period}
                placeholder="2026-T2"
                readOnly={mode === "official"}
                onChange={(event) => setPeriod(event.target.value)}
              />
            </label>
            <label>
              UF
              <select value={uf} onChange={(event) => setUf(event.target.value)}>
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
                onChange={(event) => setCity(event.target.value)}
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
                  onChange={(event) =>
                    setMapping({ ...mapping, [key]: Number(event.target.value) })
                  }
                >
                  <option value={-1}>Não importar / selecionar</option>
                  {inspection.headers.map(
                    (header, index) =>
                      isAllowedMappingColumn(key as MappingField, header) && (
                        <option key={index} value={index}>
                          {index + 1}. {header || "Sem título"}
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
              onChange={(event) => setIncludeContacts(event.target.checked)}
            />
            Importar telefone, e-mail, endereço comercial e site divulgados na fonte
          </label>
          <small>
            Campos com * são obrigatórios. Só estes campos selecionados serão mantidos. Não mapeie
            informações pessoais em campos cadastrais.
          </small>
          <button className="button button-dark" type="submit">
            Gerar prévia
          </button>
        </fieldset>
      </form>
    </section>
  );
}
