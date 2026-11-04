import { z } from "zod";
import { text } from "./shared.ts";
import { normalizeBrazilianMobile } from "../br-mobile.ts";
import { profileAvatarKeys } from "../profile-avatars.ts";

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
    consent: z.literal(true, { error: "Aceite o aviso de privacidade." }),
  })
  .strict();
export const profileSchema = z
  .object({
    name: text(2, 100),
    avatar: z.enum(profileAvatarKeys),
  })
  .strict();
