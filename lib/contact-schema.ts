import { z } from "zod";
export const interests = [
  "Conhecer a solução",
  "Hotel ou pousada",
  "Parcerias",
  "Privacidade",
  "Outro assunto",
] as const;
export const contactSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Informe seu nome (ao menos 2 caracteres).")
      .max(100, "Use até 100 caracteres."),
    email: z
      .string()
      .trim()
      .email("Informe um e-mail válido.")
      .max(254)
      .transform((value) => value.toLowerCase()),
    organization: z.string().trim().max(120, "Use até 120 caracteres.").default(""),
    interest: z.enum(interests, { errorMap: () => ({ message: "Escolha um assunto." }) }),
    message: z
      .string()
      .trim()
      .min(10, "Escreva uma mensagem com ao menos 10 caracteres.")
      .max(2000, "Use até 2.000 caracteres."),
    consent: z.literal(true, {
      errorMap: () => ({ message: "Autorize o uso dos dados para responder ao contato." }),
    }),
    website: z.string().max(0, "Não foi possível validar o envio.").default(""),
  })
  .strict();
export type ContactInput = z.infer<typeof contactSchema>;
export const privacyVersion = "2026-09-29-node";
