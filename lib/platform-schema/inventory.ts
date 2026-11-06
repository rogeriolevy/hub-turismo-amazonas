import { z } from "zod";
import { id, text, slug, price } from "./shared.ts";

export const roomOperationalStatusLabels = {
  ready: "Pronto",
  cleaning: "Em limpeza",
  maintenance: "Em manutenção",
} as const;

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
