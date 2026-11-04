import type { DatabaseExecutor } from "../../db/index.ts";
import {
  importOptionsSchema,
  isAllowedMappingColumn,
  type SourceInfo,
  type Preview,
  type MappingField,
} from "../../lib/cadastur-schema.ts";
import { requirePlatformAdmin } from "../platform-access.ts";
import type { Actor } from "../platform-models.ts";
import { one, run, parse, write } from "../platform-store.ts";
import { HttpError } from "../http.ts";
import type { ParsedFile } from "./files.ts";
import type { Existing, Staged } from "./import-model.ts";
import { hashRegistryRecord, normalizeImportRows } from "./import-normalization.ts";
export async function expirePreviews(db: DatabaseExecutor) {
  await run(
    db,
    "UPDATE cadastur_imports SET status='expired',payload=NULL WHERE status='preview' AND expires_at < ?",
    new Date().toISOString(),
  );
}
export async function createPreview(
  db: DatabaseExecutor,
  actor: Actor,
  file: ParsedFile,
  input: unknown,
  source: SourceInfo,
): Promise<Preview> {
  requirePlatformAdmin(actor);
  const options = parse(importOptionsSchema, input);
  if (
    options.category !== source.category ||
    file.checksum !== options.checksum ||
    options.sheet !== file.sheet
  )
    throw new HttpError(
      409,
      "FILE_CHANGED",
      "O arquivo ou a aba mudou. Leia as colunas novamente.",
    );
  for (const [field, index] of Object.entries(options.mapping))
    if (
      index >= 0 &&
      (index >= file.headers.length ||
        !isAllowedMappingColumn(field as MappingField, file.headers[index]))
    )
      throw new HttpError(
        422,
        "MAPPING",
        "Mapeie contatos apenas nas colunas comerciais correspondentes. CPF, dados pessoais e e-mail do administrador não são importados.",
      );
  const required = [
    options.mapping.external_id,
    options.mapping.name,
    options.mapping.uf,
    options.mapping.city,
  ];
  if (new Set(required).size !== required.length)
    throw new HttpError(
      422,
      "MAPPING",
      "Use colunas distintas para identificação, nome, UF e município.",
    );
  const { counts, issues, candidates } = normalizeImportRows(file, options);
  const issue = (row: number, message: string) => {
    if (issues.length < 100) issues.push({ row, message });
  };
  const staged: Staged[] = [];
  for (const { record, row } of candidates.values()) {
    const existing = await one<Existing>(
      db,
      "SELECT * FROM cadastur_entries WHERE category=? AND external_id=?",
      options.category,
      record.external_id,
    );
    if (existing && existing.period > options.period) {
      counts.older++;
      issue(row, "Já existe uma referência mais recente. Esta linha será ignorada.");
      continue;
    }
    const dataHash = hashRegistryRecord(record);
    const action = !existing
      ? "added"
      : existing.data_hash === dataHash && existing.period === options.period
        ? "unchanged"
        : "updated";
    counts[action]++;
    staged.push({
      record,
      hash: dataHash,
      previous: existing?.data_hash || null,
      previousPeriod: existing?.period || null,
      action,
    });
  }
  if (staged.length > 10000)
    throw new HttpError(
      422,
      "SELECTION_SIZE",
      "A seleção ultrapassa 10 mil registros. Filtre também por município.",
    );
  const id = crypto.randomUUID(),
    now = new Date().toISOString(),
    expires_at = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  await write(db, async (tx) => {
    await expirePreviews(tx);
    await run(
      tx,
      "UPDATE cadastur_imports SET status='expired',payload=NULL WHERE actor_id=? AND status='preview'",
      actor.id,
    );
    await run(
      tx,
      "INSERT INTO cadastur_imports (id,actor_id,category,period,source_json,checksum,summary,payload,status,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?, 'preview',?,?)",
      id,
      actor.id,
      options.category,
      options.period,
      JSON.stringify(source),
      file.checksum,
      JSON.stringify(counts),
      JSON.stringify(staged),
      now,
      expires_at,
    );
  });
  return {
    id,
    counts,
    records: staged.slice(0, 100).map((s) => ({ ...s.record, action: s.action })),
    issues,
    expires_at,
    source,
    period: options.period,
  };
}
export { commitImport } from "./import-commit-service.ts";
