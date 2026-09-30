import type Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  importOptionsSchema,
  categorySchema,
  isSensitiveColumn,
  normalizeLabel,
  states,
  type RegistryData,
  type SourceInfo,
  type Preview,
  type RegistryEntry,
  type ImportHistory,
} from "../../lib/cadastur-schema.ts";
import { requirePlatformAdmin } from "../platform-access.ts";
import type { Actor } from "../platform-models.ts";
import { one, many, parse, write, audit } from "../platform-store.ts";
import { HttpError } from "../http.ts";
import type { ParsedFile } from "./files.ts";

type Existing = RegistryEntry & { data_hash: string };
type Staged = {
  record: RegistryData;
  hash: string;
  previous: string | null;
  previousPeriod: string | null;
  action: "added" | "updated" | "unchanged";
};
const hash = (record: RegistryData) =>
  createHash("sha256").update(JSON.stringify(record)).digest("hex");
const activities = {
  hospedagens: "Meio de Hospedagem",
  guias: "Guia de Turismo",
  gastronomia: "Restaurante, Cafeteria, Bar e Similares",
  transportes: "Transportadora Turística",
};
const clean = (value: string) =>
  value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const blank = (value: string) => (value === "-" ? "" : value);
const date = (value: string) => {
  if (!value || value === "-") return "";
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const result = match ? `${match[3]}-${match[2]}-${match[1]}` : value;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(result) ||
    !Number.isFinite(Date.parse(result)) ||
    new Date(result).toISOString().slice(0, 10) !== result
  )
    throw Error("Validade do certificado inválida.");
  return result;
};
export function expirePreviews(db: Database.Database) {
  db.prepare(
    "UPDATE cadastur_imports SET status='expired',payload=NULL WHERE status='preview' AND expires_at < ?",
  ).run(new Date().toISOString());
}
export function createPreview(
  db: Database.Database,
  actor: Actor,
  file: ParsedFile,
  input: unknown,
  source: SourceInfo,
): Preview {
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
  for (const index of Object.values(options.mapping))
    if (index >= 0 && (index >= file.headers.length || isSensitiveColumn(file.headers[index])))
      throw new HttpError(
        422,
        "MAPPING",
        "Selecione somente colunas cadastrais. CPF, contatos e dados pessoais adicionais não são importados.",
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
  const activityIndex = file.headers.findIndex((h) => normalizeLabel(h) === "atividadeturistica");
  const cpfIndex = file.headers.findIndex((h) => normalizeLabel(h) === "cpf");
  const idIsCertificate = /certificado|cadastur/.test(
    normalizeLabel(file.headers[options.mapping.external_id]),
  );
  const counts: Preview["counts"] = {
    total: file.rows,
    filtered: 0,
    invalid: 0,
    duplicates: 0,
    conflicts: 0,
    older: 0,
    added: 0,
    updated: 0,
    unchanged: 0,
  };
  const issues: Preview["issues"] = [];
  const issue = (row: number, message: string) => {
    if (issues.length < 100) issues.push({ row, message });
  };
  const candidates = new Map<string, { record: RegistryData; row: number }>();
  const conflicting = new Set<string>();
  file.data.forEach((row, index) => {
    const rowNumber = index + 2;
    const get = (field: keyof typeof options.mapping) =>
      blank(clean(row[options.mapping[field]] || ""));
    const uf = get("uf").toUpperCase(),
      city = get("city");
    if (
      states.includes(uf) &&
      (uf !== options.uf || (options.city && normalizeLabel(city) !== normalizeLabel(options.city)))
    ) {
      counts.filtered++;
      return;
    }
    try {
      if (
        activityIndex >= 0 &&
        normalizeLabel(row[activityIndex] || "") !== normalizeLabel(activities[options.category])
      )
        throw Error("A atividade não corresponde ao módulo selecionado.");
      const external_id = get("external_id")
        .replace(/[.\s/\-]/g, "")
        .toUpperCase();
      if (!/^[A-Z0-9]{6,40}$/.test(external_id))
        throw Error("Certificado/CNPJ ausente ou inválido.");
      if (/^\d{11}$/.test(external_id) && !idIsCertificate)
        throw Error("Identificador de 11 dígitos exige a coluna de certificado Cadastur.");
      if (cpfIndex >= 0 && external_id === (row[cpfIndex] || "").replace(/\D/g, ""))
        throw Error("O identificador corresponde ao CPF; selecione o certificado Cadastur.");
      const name = get("name") || get("fallback_name");
      if (
        name.length < 2 ||
        name.length > 200 ||
        city.length < 2 ||
        city.length > 100 ||
        !states.includes(uf)
      )
        throw Error("Confira nome, município e sigla da UF.");
      const subtype = get("subtype"),
        registry_status = get("registry_status");
      if (subtype.length > 500 || registry_status.length > 100)
        throw Error("Tipo ou situação cadastral excede o tamanho permitido.");
      const record: RegistryData = {
        external_id,
        name,
        uf,
        city,
        subtype,
        registry_status,
        valid_until: date(get("valid_until")),
      };
      if (conflicting.has(external_id)) {
        counts.conflicts++;
        issue(rowNumber, "Identificador repetido com dados divergentes; revise o arquivo.");
        return;
      }
      const previous = candidates.get(external_id);
      if (previous) {
        if (hash(previous.record) === hash(record)) counts.duplicates++;
        else {
          candidates.delete(external_id);
          conflicting.add(external_id);
          counts.conflicts += 2;
          issue(
            previous.row,
            "Identificador repetido com dados divergentes; nenhuma versão será importada.",
          );
          issue(rowNumber, "Identificador repetido com dados divergentes.");
        }
      } else candidates.set(external_id, { record, row: rowNumber });
    } catch (error) {
      counts.invalid++;
      issue(rowNumber, error instanceof Error ? error.message : "Linha inválida.");
    }
  });
  const staged: Staged[] = [];
  for (const { record, row } of candidates.values()) {
    const existing = one<Existing>(
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
    const dataHash = hash(record);
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
  write(db, () => {
    expirePreviews(db);
    db.prepare(
      "UPDATE cadastur_imports SET status='expired',payload=NULL WHERE actor_id=? AND status='preview'",
    ).run(actor.id);
    db.prepare(
      "INSERT INTO cadastur_imports (id,actor_id,category,period,source_json,checksum,summary,payload,status,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?, 'preview',?,?)",
    ).run(
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
type Batch = {
  id: string;
  actor_id: string;
  status: string;
  payload: string | null;
  summary: string;
  expires_at: string;
  category: string;
  period: string;
  source_json: string;
};
export function commitImport(db: Database.Database, actor: Actor, input: unknown) {
  requirePlatformAdmin(actor);
  const { id } = parse(z.object({ id: z.string().uuid() }).strict(), input);
  return write(db, () => {
    const batch = one<Batch>(
      db,
      "SELECT * FROM cadastur_imports WHERE id=? AND actor_id=?",
      id,
      actor.id,
    );
    if (!batch) throw new HttpError(404, "NOT_FOUND", "Prévia não encontrada.");
    if (batch.status === "committed") return { id, counts: JSON.parse(batch.summary) };
    if (!batch.payload || batch.status !== "preview" || batch.expires_at < new Date().toISOString())
      throw new HttpError(
        409,
        "EXPIRED",
        "A prévia expirou ou foi substituída. Gere uma nova prévia.",
      );
    const rows = JSON.parse(batch.payload) as Staged[];
    if (!rows.some((r) => r.action !== "unchanged"))
      throw new HttpError(422, "NO_CHANGES", "Não há inclusões ou alterações para confirmar.");
    const now = new Date().toISOString();
    for (const entry of rows) {
      const current = one<Existing>(
        db,
        "SELECT * FROM cadastur_entries WHERE category=? AND external_id=?",
        batch.category,
        entry.record.external_id,
      );
      if (
        (current?.data_hash || null) !== entry.previous ||
        (current?.period || null) !== entry.previousPeriod
      )
        throw new HttpError(
          409,
          "STALE_PREVIEW",
          "O diretório mudou desde a prévia. Gere outra prévia antes de confirmar.",
        );
      if (entry.action === "unchanged") continue;
      const r = entry.record;
      db.prepare(
        `INSERT INTO cadastur_entries (id,category,external_id,name,uf,city,subtype,registry_status,valid_until,period,data_hash,source_json,import_id,imported_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(category,external_id) DO UPDATE SET name=excluded.name,uf=excluded.uf,city=excluded.city,subtype=excluded.subtype,registry_status=excluded.registry_status,valid_until=excluded.valid_until,period=excluded.period,data_hash=excluded.data_hash,source_json=excluded.source_json,import_id=excluded.import_id,imported_at=excluded.imported_at,review_status='pending'`,
      ).run(
        crypto.randomUUID(),
        batch.category,
        r.external_id,
        r.name,
        r.uf,
        r.city,
        r.subtype,
        r.registry_status,
        r.valid_until,
        batch.period,
        entry.hash,
        batch.source_json,
        id,
        now,
      );
    }
    db.prepare(
      "UPDATE cadastur_imports SET status='committed',payload=NULL,committed_at=? WHERE id=?",
    ).run(now, id);
    audit(db, actor.id, null, "cadastur.import", id);
    return { id, counts: JSON.parse(batch.summary) };
  });
}
export function reviewEntry(db: Database.Database, actor: Actor, input: unknown) {
  requirePlatformAdmin(actor);
  const data = parse(
    z
      .object({
        id: z.string().uuid(),
        company_id: z.string().uuid().nullable().default(null),
        guide_id: z.string().uuid().nullable().default(null),
      })
      .strict(),
    input,
  );
  return write(db, () => {
    const entry = one<Existing>(db, "SELECT * FROM cadastur_entries WHERE id=?", data.id);
    if (!entry) throw new HttpError(404, "NOT_FOUND", "Registro não encontrado.");
    if (data.company_id) {
      const company = one<{ kind: string }>(
        db,
        "SELECT kind FROM companies WHERE id=?",
        data.company_id,
      );
      if (!company || entry.category !== "hospedagens" || company.kind !== "hotel")
        throw new HttpError(
          422,
          "LINK",
          "Hospedagens podem ser vinculadas a uma empresa hoteleira existente.",
        );
    }
    if (
      data.guide_id &&
      (entry.category !== "guias" || !one(db, "SELECT id FROM guides WHERE id=?", data.guide_id))
    )
      throw new HttpError(422, "LINK", "Selecione um perfil de guia existente.");
    db.prepare(
      "UPDATE cadastur_entries SET review_status='reviewed',company_id=?,guide_id=? WHERE id=?",
    ).run(data.company_id, data.guide_id, data.id);
    audit(db, actor.id, data.company_id, "cadastur.review", data.id);
    return { id: data.id };
  });
}
export function listDirectory(db: Database.Database, actor: Actor, input: unknown) {
  requirePlatformAdmin(actor);
  const { category, page, q } = parse(
    z.object({
      category: categorySchema,
      page: z.coerce.number().int().min(1).max(10000).default(1),
      q: z.string().trim().max(100).default(""),
    }),
    input,
  );
  const filter = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const where = "category=? AND (name LIKE ? ESCAPE '\\' OR city LIKE ? ESCAPE '\\')";
  return {
    entries: many<RegistryEntry>(
      db,
      "SELECT id,category,external_id,name,uf,city,subtype,registry_status,valid_until,period,company_id,guide_id,review_status,imported_at FROM cadastur_entries WHERE " +
        where +
        " ORDER BY name,id LIMIT 20 OFFSET ?",
      category,
      filter,
      filter,
      (page - 1) * 20,
    ),
    total: one<{ n: number }>(
      db,
      "SELECT COUNT(*) n FROM cadastur_entries WHERE " + where,
      category,
      filter,
      filter,
    )!.n,
    history: many<ImportHistory>(
      db,
      "SELECT id,category,period,created_at,status,summary FROM cadastur_imports WHERE category=? AND status='committed' ORDER BY created_at DESC LIMIT 10",
      category,
    ),
    page,
  };
}
