"use client";
import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/components/site/language-provider";
import { translate } from "@/lib/i18n/messages";

type Option = { value: string; label: string };
type Result = {
  data: Option[];
  selected: Option | null;
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  error?: { message?: string };
};
type Entity = "company" | "guide";
type MessageKey = Parameters<typeof translate>[1];
type OptionMessage =
  "search" | "loading" | "empty" | "error" | "prompt" | "placeholder" | "pagination";

export function PlatformOptionSelect({
  id,
  name,
  label,
  required = false,
  initialValue = "",
  initialLabel,
  emptyOptionLabel,
  disabled = false,
  entity = "company",
  companyKind,
  companyId,
  onValueChange,
}: {
  id: string;
  name: string;
  label: string;
  required?: boolean;
  initialValue?: string;
  initialLabel?: string;
  emptyOptionLabel?: string;
  disabled?: boolean;
  entity?: Entity;
  companyKind?: "hotel" | "operator";
  companyId?: string;
  onValueChange?: (value: string) => void;
}) {
  const { locale } = useLanguage();
  const localize = useCallback(
    (key: MessageKey, values?: Record<string, string | number>) => translate(locale, key, values),
    [locale],
  );
  const optionMessage = useCallback(
    (key: OptionMessage) =>
      localize(`${entity === "guide" ? "guideOptions" : "companyOptions"}.${key}` as MessageKey),
    [entity, localize],
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(initialValue);
  const [options, setOptions] = useState<Option[]>(
    initialValue ? [{ value: initialValue, label: initialLabel || initialValue }] : [],
  );
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ q: query, page: String(page) });
        if (selected) params.set("selected", selected);
        if (companyKind) params.set("kind", companyKind);
        if (companyId) params.set("empresa", companyId);
        const endpoint = entity === "guide" ? "opcoes-guias" : "opcoes-empresas";
        const response = await fetch(`/api/plataforma/${endpoint}?${params}`, {
          signal: controller.signal,
        });
        const result = (await response.json()) as Result;
        if (!response.ok) throw new Error(result.error?.message || optionMessage("error"));
        const next = result.data.slice();
        if (result.selected && !next.some((option) => option.value === result.selected?.value))
          next.unshift(result.selected);
        if (selected && !next.some((option) => option.value === selected))
          next.unshift({
            value: selected,
            label: selected === initialValue ? initialLabel || selected : selected,
          });
        setOptions(next);
        setTotal(result.meta.total);
        setTotalPages(result.meta.totalPages);
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : optionMessage("error"));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [
    companyId,
    companyKind,
    entity,
    initialLabel,
    initialValue,
    optionMessage,
    page,
    query,
    selected,
  ]);

  return (
    <>
      <div className="platform-option-search">
        <label htmlFor={`${id}-search`}>{optionMessage("search")}</label>
        <input
          id={`${id}-search`}
          type="search"
          value={query}
          maxLength={100}
          autoComplete="off"
          placeholder={optionMessage("prompt")}
          aria-controls={id}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          disabled={disabled}
        />
      </div>
      <div className="platform-option-value">
        <label htmlFor={id}>{label}</label>
        <select
          id={id}
          name={name}
          value={selected}
          required={required}
          disabled={disabled}
          onChange={(event) => {
            setSelected(event.target.value);
            onValueChange?.(event.target.value);
          }}
        >
          <option value="">{emptyOptionLabel || optionMessage("placeholder")}</option>
          {options.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <p className="platform-option-status" aria-live="polite">
        {loading
          ? optionMessage("loading")
          : error
            ? error
            : total === 0
              ? optionMessage("empty")
              : localize("companyOptions.page", { page, totalPages, total })}
      </p>
      {totalPages > 1 && (
        <nav className="cadastur-pagination" aria-label={optionMessage("pagination")}>
          <button
            className="button button-outline"
            type="button"
            disabled={disabled || loading || page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            {localize("audit.previous")}
          </button>
          <button
            className="button button-outline"
            type="button"
            disabled={disabled || loading || page >= totalPages}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
          >
            {localize("audit.next")}
          </button>
        </nav>
      )}
    </>
  );
}
