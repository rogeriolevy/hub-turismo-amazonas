import { z } from "zod";
import { id, text } from "./shared.ts";

export const bookingLabels = {
  pending: "Aguardando aprovação",
  confirmed: "Confirmada",
  declined: "Não aprovada",
  cancelled: "Cancelada",
} as const;

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
