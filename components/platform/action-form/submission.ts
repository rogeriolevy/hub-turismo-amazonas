import { decisionSchema, staySchema } from "@/lib/platform-schema/booking";
import { companySchema, memberSchema } from "@/lib/platform-schema/company";
import {
  departureSchema,
  guideSchema,
  roomOperationalStatusSchema,
  roomSchema,
  tourSchema,
} from "@/lib/platform-schema/inventory";
import type { Field, Values } from "./types";

const schemas = {
  empresas: companySchema,
  acessos: memberSchema,
  quartos: roomSchema,
  "quarto-status": roomOperationalStatusSchema,
  guias: guideSchema,
  passeios: tourSchema,
  saidas: departureSchema,
  decisao: decisionSchema,
  estadia: staySchema,
};

export type ActionSubmission = { ok: true; body: Values } | { ok: false; feedback: string };

export function prepareActionSubmission(
  action: string,
  fields: Field[],
  fixed: Values,
  form: FormData,
): ActionSubmission {
  const body: Values = { ...fixed };

  for (const field of fields) {
    const value = String(form.get(field.name) ?? "");
    if (field.kindFromValue && value in field.kindFromValue) body.kind = field.kindFromValue[value];
    if (field.type === "datetime-local" && value && Number.isNaN(Date.parse(value + "-04:00")))
      return {
        ok: false,
        feedback: `${field.label}: informe uma data e um horário válidos.`,
      };

    body[field.name] =
      field.type === "guide-select"
        ? value || null
        : field.type === "checkbox"
          ? form.has(field.name)
          : field.type === "number"
            ? Number(value)
            : field.type === "currency"
              ? Math.round(Number(value) * 100)
              : field.type === "datetime-local" && value
                ? new Date(value + "-04:00").toISOString()
                : value;
  }

  const schema = schemas[action as keyof typeof schemas];
  const validation = schema?.safeParse(body);
  if (validation && !validation.success) {
    return {
      ok: false,
      feedback: validation.error.issues
        .map(
          (item) =>
            `${fields.find((field) => field.name === item.path[0])?.label || "Campo"}: ${item.message}`,
        )
        .join(" "),
    };
  }

  return { ok: true, body };
}
