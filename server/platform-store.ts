import type { z } from "zod";
import { many, one, run, write, type DatabaseExecutor } from "../db/index.ts";
import { HttpError } from "./http.ts";

export { many, one, run, write };

export function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new HttpError(
      422,
      "VALIDATION",
      "Confira os campos informados.",
      result.error.flatten().fieldErrors,
    );
  return result.data;
}

export async function audit(
  db: DatabaseExecutor,
  actorId: string,
  companyId: string | null,
  action: string,
  entityId: string,
) {
  await run(
    db,
    "INSERT INTO platform_audit VALUES (?,?,?,?,?,?)",
    crypto.randomUUID(),
    actorId,
    companyId,
    action,
    entityId,
    new Date().toISOString(),
  );
}
