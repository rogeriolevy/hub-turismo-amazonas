export type Field = {
  name: string;
  label: string;
  type?:
    | "text"
    | "email"
    | "textarea"
    | "number"
    | "currency"
    | "checkbox"
    | "select"
    | "company-select"
    | "guide-select"
    | "datetime-local";
  required?: boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  maxLength?: number;
  hint?: string;
  kindFromValue?: Record<string, "hotel" | "operator">;
  visibleWhen?: { field: string; value: string };
  companyField?: string;
};

export type Values = Record<string, string | number | boolean | null>;
