import { z } from "zod";
import { normalizeBrazilianMobile } from "./br-mobile.ts";
import { profileAvatarKeys } from "./profile-avatars.ts";
import { catalogCategories } from "./catalog-content.ts";

const id = z.string().uuid();
const text = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, `Use ao menos ${min} caracteres.`)
    .max(max, `Use até ${max} caracteres.`);
const slug = z
  .string()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífens.");
const price = z.number().int().min(0).max(100000000);
export const roles = {
  hotel_manager: "Gestor hoteleiro",
  hotel_staff: "Equipe hoteleira",
  operator: "Operador turístico (passeios ou transportes)",
  guide: "Guia",
} as const;
export const bookingLabels = {
  pending: "Aguardando aprovação",
  confirmed: "Confirmada",
  declined: "Não aprovada",
  cancelled: "Cancelada",
} as const;
export const roomOperationalStatusLabels = {
  ready: "Pronto",
  cleaning: "Em limpeza",
  maintenance: "Em manutenção",
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
  })
  .strict();
export const roomSchema = z
  .object({
    id: id.optional(),
    company_id: id,
    code: text(1, 30),
    name: text(2, 100),
    capacity: z.number().int().min(1).max(20),
    price_cents: price,
    active: z.boolean(),
  })
  .strict();
export const roomOperationalStatusSchema = z
  .object({
    company_id: id,
    room_id: id,
    operational_status: z.enum(["ready", "cleaning", "maintenance"]),
  })
  .strict();
export const guideSchema = z
  .object({
    id: id.optional(),
    company_id: id,
    slug,
    name: text(2, 100),
    bio: text(20, 2000),
    languages: text(2, 150),
    published: z.boolean(),
  })
  .strict();
export const tourSchema = z
  .object({
    id: id.optional(),
    company_id: id,
    slug,
    name: text(2, 100),
    description: text(20, 2000),
    city: text(2, 100),
    duration_minutes: z.number().int().min(15).max(1440),
    price_cents: price,
    guide_id: z.union([id, z.literal("")]).transform((v) => v || null),
    published: z.boolean(),
  })
  .strict();
export const departureSchema = z
  .object({
    id: id.optional(),
    company_id: id,
    tour_id: id,
    starts_at: z.string().datetime(),
    capacity: z.number().int().min(1).max(100),
    active: z.boolean(),
  })
  .strict();
const catalogImageUrl = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) =>
      !value ||
      (/^\/uploads\/catalog\/[a-f0-9-]{36}\.(?:jpg|png|webp)$/i.test(value) &&
        !value.includes("..")) ||
      (() => {
        try {
          return new URL(value).protocol === "https:";
        } catch {
          return false;
        }
      })(),
    "Use uma imagem HTTPS ou envie o arquivo pelo formulário.",
  );
const catalogWebsite = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) =>
      !value ||
      (() => {
        try {
          return ["https:", "http:"].includes(new URL(value).protocol);
        } catch {
          return false;
        }
      })(),
    "Informe um endereço começando com https:// ou http://.",
  );
export const catalogItemSchema = z
  .object({
    id: id.optional(),
    source_entry_id: id.nullable().optional().default(null),
    category: z.enum(catalogCategories),
    name: text(2, 120),
    slug,
    city: text(2, 100),
    subtype: z.string().trim().max(100).default(""),
    summary: text(15, 260),
    description: text(20, 5000),
    details: z.string().trim().max(5000).default(""),
    address: z.string().trim().max(300).default(""),
    phone: z.string().trim().max(40).default(""),
    email: z.union([z.string().trim().email().max(254), z.literal("")]).default(""),
    website: catalogWebsite.default(""),
    image_urls: z.array(catalogImageUrl).max(8),
    status: z.enum(["draft", "published"]),
  })
  .strict();
export const catalogItemDeleteSchema = z.object({ id }).strict();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    "Data inválida.",
  );
const commonBooking = {
  guests: z.number().int().min(1).max(20),
  notes: z.string().trim().max(1000).default(""),
};
export const bookingSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("hotel"),
      room_id: id,
      check_in: date,
      check_out: date,
      ...commonBooking,
    })
    .strict(),
  z.object({ kind: z.literal("tour"), departure_id: id, ...commonBooking }).strict(),
]);
export const decisionSchema = z
  .object({ company_id: id, booking_id: id, decision: z.enum(["confirmed", "declined"]) })
  .strict();
export const staySchema = z
  .object({
    company_id: id,
    booking_id: id,
    action: z.enum(["checkin", "checkout"]),
    country: text(2, 80).default("Brasil"),
    origin_city: text(2, 100).default("Não informado"),
  })
  .strict();
export const registrationSchema = z
  .object({
    name: text(2, 100),
    email: z.string().trim().toLowerCase().email().max(254),
    phoneNumber: z
      .string()
      .trim()
      .transform((value, context) => {
        const normalized = normalizeBrazilianMobile(value);
        if (!normalized) {
          context.addIssue({
            code: "custom",
            message:
              "Informe um celular brasileiro válido com DDD. Confira se o número não é fictício.",
          });
          return z.NEVER;
        }
        return normalized;
      }),
    password: z.string().min(12, "Use ao menos 12 caracteres.").max(128),
    consent: z.literal(true, { errorMap: () => ({ message: "Aceite o aviso de privacidade." }) }),
  })
  .strict();
export const profileSchema = z
  .object({
    name: text(2, 100),
    avatar: z.enum(profileAvatarKeys),
  })
  .strict();
export function companyDisplayName(company: { name: string; trade_name?: string }) {
  return company.trade_name?.trim() || company.name;
}
export function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
export function todayInManaus(now = new Date()) {
  return new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
export function displayDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "America/Manaus",
  }).format(new Date(value.length === 10 ? value + "T12:00:00Z" : value));
}
export function displayTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Manaus",
  }).format(new Date(value));
}
