import { z } from "zod";
export const id = z.string().uuid();
export const text = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, `Use ao menos ${min} caracteres.`)
    .max(max, `Use até ${max} caracteres.`);
export const slug = z
  .string()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífens.");
export const price = z.number().int().min(0).max(100000000);
