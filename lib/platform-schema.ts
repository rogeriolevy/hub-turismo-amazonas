import { z } from "zod";

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
  operator: "Operador de passeios",
  guide: "Guia",
} as const;
export const bookingLabels = {
  pending: "Aguardando aprovação",
  confirmed: "Confirmada",
  declined: "Não aprovada",
  cancelled: "Cancelada",
} as const;
export const companySchema = z
  .object({
    id: id.optional(),
    kind: z.enum(["hotel", "operator"]),
    name: text(2, 100),
    trade_name: z.union([text(2, 100), z.string().trim().length(0)]).optional(),
    slug,
    city: text(2, 100),
    description: text(20, 2000),
    status: z.enum(["draft", "published", "suspended"]),
  })
  .strict();
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
    password: z.string().min(12, "Use ao menos 12 caracteres.").max(128),
    consent: z.literal(true, { errorMap: () => ({ message: "Aceite o aviso de privacidade." }) }),
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
