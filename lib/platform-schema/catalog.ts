import { z } from "zod";
import { id, text, slug } from "./shared.ts";
import { catalogCategories } from "../catalog-content.ts";

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
