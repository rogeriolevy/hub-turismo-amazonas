import type Database from "better-sqlite3";
import type { z } from "zod";
import { HttpError } from "./http.ts";
type Value = string | number | null;
export function one<T>(db: Database.Database, sql: string, ...values: Value[]) {
  return db.prepare<Value[], T>(sql).get(...values);
}
export function many<T>(db: Database.Database, sql: string, ...values: Value[]) {
  return db.prepare<Value[], T>(sql).all(...values);
}
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
export function audit(
  db: Database.Database,
  actorId: string,
  companyId: string | null,
  action: string,
  entityId: string,
) {
  db.prepare("INSERT INTO platform_audit VALUES (?,?,?,?,?,?)").run(
    crypto.randomUUID(),
    actorId,
    companyId,
    action,
    entityId,
    new Date().toISOString(),
  );
}
export function write<T>(db: Database.Database, action: () => T): T {
  try {
    return db.transaction(action).immediate();
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      String(error.code) === "SQLITE_CONSTRAINT_UNIQUE"
    )
      throw new HttpError(
        409,
        "DUPLICATE",
        "Este identificador já está cadastrado. Escolha outro.",
      );
    throw error;
  }
}
