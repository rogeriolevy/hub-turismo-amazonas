import { translateText, type Locale } from "@/lib/i18n/messages";
import { PlatformOptionSelect } from "../platform-option-select";
import type { Field, Values } from "./types";

export function ActionFormFields({
  action,
  fields,
  fixed,
  initial,
  fieldValues,
  busy,
  locale,
  onFieldValueChange,
}: {
  action: string;
  fields: Field[];
  fixed: Values;
  initial: Values;
  fieldValues: Record<string, string>;
  busy: boolean;
  locale: Locale;
  onFieldValueChange: (name: string, value: string) => void;
}) {
  const localize = (value: string) => translateText(locale, value);

  return fields.map((field) => {
    if (field.visibleWhen && fieldValues[field.visibleWhen.field] !== field.visibleWhen.value)
      return null;

    const fieldId = `${action}-${String(fixed.id || fixed.company_id || fixed.booking_id || "new")}-${field.name}`;
    let value = initial[field.name];
    if (field.type === "currency" && typeof value === "number") value = value / 100;
    if (field.type === "datetime-local" && typeof value === "string" && value)
      value = new Date(Date.parse(value) - 4 * 3600000).toISOString().slice(0, 16);

    const updateValue = (next: string) => onFieldValueChange(field.name, next);

    return (
      <div className={field.type === "checkbox" ? "platform-checkbox" : "field"} key={field.name}>
        {field.type !== "company-select" && field.type !== "guide-select" && (
          <label htmlFor={fieldId}>{localize(field.label)}</label>
        )}
        {field.type === "company-select" ? (
          <PlatformOptionSelect
            id={fieldId}
            name={field.name}
            label={localize(field.label)}
            required={field.required !== false}
            initialValue={String(value ?? "")}
            disabled={busy}
            onValueChange={updateValue}
          />
        ) : field.type === "guide-select" ? (
          <PlatformOptionSelect
            key={field.companyField ? fieldValues[field.companyField] || "no-company" : "guide"}
            id={fieldId}
            name={field.name}
            label={localize(field.label)}
            entity="guide"
            companyKind="operator"
            companyId={field.companyField ? fieldValues[field.companyField] : undefined}
            required={field.required !== false}
            initialValue={String(value ?? "")}
            disabled={busy || Boolean(field.companyField && !fieldValues[field.companyField])}
            onValueChange={updateValue}
          />
        ) : field.type === "textarea" ? (
          <textarea
            id={fieldId}
            name={field.name}
            rows={4}
            required={field.required !== false}
            maxLength={field.maxLength || 2000}
            defaultValue={String(value ?? "")}
            disabled={busy}
            onChange={(event) => updateValue(event.target.value)}
          />
        ) : field.type === "select" ? (
          <select
            id={fieldId}
            name={field.name}
            required={field.required !== false}
            defaultValue={String(value ?? "")}
            disabled={busy}
            onChange={(event) => updateValue(event.target.value)}
          >
            {!field.options?.some((option) => option.value === "") && (
              <option value="">{localize("Selecione")}</option>
            )}
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {localize(option.label)}
              </option>
            ))}
          </select>
        ) : field.type === "checkbox" ? (
          <input
            id={fieldId}
            type="checkbox"
            name={field.name}
            defaultChecked={Boolean(value)}
            disabled={busy}
          />
        ) : (
          <input
            id={fieldId}
            name={field.name}
            type={field.type === "currency" ? "number" : field.type || "text"}
            required={field.required !== false}
            defaultValue={String(value ?? "")}
            min={field.min ?? (field.type === "currency" ? 0 : undefined)}
            max={field.max}
            step={field.type === "currency" ? "0.01" : field.type === "number" ? "1" : undefined}
            maxLength={field.maxLength || 150}
            disabled={busy}
          />
        )}{" "}
        {field.hint && <span className="field-help">{localize(field.hint)}</span>}
      </div>
    );
  });
}
