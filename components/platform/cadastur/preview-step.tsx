"use client";

import type { Preview } from "@/lib/cadastur-schema";
import type { Locale } from "@/lib/i18n/messages";
import { LocalizedEmptyState } from "../shared-views";

type Props = {
  preview: Preview;
  locale: Locale;
  busy: string;
  onConfirm: () => void;
};

const actions: Record<string, string> = {
  added: "Incluir",
  updated: "Atualizar",
  unchanged: "Sem alteração",
};

export function CadasturPreviewStep({ preview, locale, busy, onConfirm }: Props) {
  return (
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
            {preview.issues.map((issue, index) => (
              <li key={index}>
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
        <LocalizedEmptyState locale={locale} title="Nenhum registro válido neste recorte.">
          <p>Confira as colunas, a aba, a UF e as ocorrências antes de tentar novamente.</p>
        </LocalizedEmptyState>
      )}
      <p>
        A confirmação grava {preview.counts.added + preview.counts.updated} registros no diretório
        interno. A prévia expira em 30 minutos.
      </p>
      <button
        disabled={!!busy || preview.counts.added + preview.counts.updated === 0}
        className="button button-dark"
        onClick={onConfirm}
      >
        Confirmar importação
      </button>
    </section>
  );
}
