import { z } from "zod";
import { id, text, slug } from "./shared.ts";

export const roles = {
  hotel_manager: "Gestor hoteleiro",
  hotel_staff: "Equipe hoteleira",
  operator: "Operador turístico (passeios ou transportes)",
  guide: "Guia",
} as const;

export const companyActivityTypes = [
  "hotel",
  "pousada",
  "albergue_hostel",
  "alojamento_floresta",
  "flat_aparthotel",
  "hotel_fazenda",
  "resort",
  "cama_cafe",
  "camping",
  "outro_hospedagem",
  "passeios",
  "navegacao_fluvial",
  "transporte_aereo",
  "transportadora_turistica",
  "outro_operador",
] as const;
export type CompanyActivityType = (typeof companyActivityTypes)[number];
export const companyActivityLabels: Record<CompanyActivityType, string> = {
  hotel: "Hotel",
  pousada: "Pousada",
  albergue_hostel: "Albergue / hostel",
  alojamento_floresta: "Alojamento de floresta",
  flat_aparthotel: "Flat / apart-hotel",
  hotel_fazenda: "Hotel fazenda",
  resort: "Resort",
  cama_cafe: "Cama e café",
  camping: "Camping",
  outro_hospedagem: "Outro meio de hospedagem",
  passeios: "Experiências turísticas",
  navegacao_fluvial: "Navegação fluvial",
  transporte_aereo: "Transporte aéreo",
  transportadora_turistica: "Transportadora turística",
  outro_operador: "Outro operador turístico",
};
export const companyActivityKinds: Record<CompanyActivityType, "hotel" | "operator"> = {
  hotel: "hotel",
  pousada: "hotel",
  albergue_hostel: "hotel",
  alojamento_floresta: "hotel",
  flat_aparthotel: "hotel",
  hotel_fazenda: "hotel",
  resort: "hotel",
  cama_cafe: "hotel",
  camping: "hotel",
  outro_hospedagem: "hotel",
  passeios: "operator",
  navegacao_fluvial: "operator",
  transporte_aereo: "operator",
  transportadora_turistica: "operator",
  outro_operador: "operator",
};

export const companySchema = z
  .object({
    id: id.optional(),
    kind: z.enum(["hotel", "operator"]),
    activity_type: z.enum(companyActivityTypes).optional(),
    name: text(2, 100),
    trade_name: z.union([text(2, 100), z.string().trim().length(0)]).optional(),
    slug,
    city: text(2, 100),
    description: text(20, 2000),
    status: z.enum(["draft", "published", "suspended"]),
    provider_data_confirmed: z.boolean().optional(),
  })
  .strict()
  .superRefine((company, context) => {
    if (company.activity_type && companyActivityKinds[company.activity_type] !== company.kind) {
      context.addIssue({
        code: "custom",
        path: ["activity_type"],
        message: "O tipo de atividade não corresponde ao segmento operacional.",
      });
    }
  });
export const memberSchema = z
  .object({
    company_id: id,
    email: z.string().trim().toLowerCase().email().max(254),
    role: z.enum(["hotel_manager", "hotel_staff", "operator", "guide"]),
    guide_id: id.nullable().optional(),
  })
  .strict();

export function companyDisplayName(company: { name: string; trade_name?: string }) {
  return company.trade_name?.trim() || company.name;
}
