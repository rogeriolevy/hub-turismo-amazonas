import { createHash } from "node:crypto";
import {
  normalizeLabel,
  states,
  type ImportOptions,
  type Preview,
  type RegistryData,
} from "../../lib/cadastur-schema.ts";
import {
  cleanPublicText,
  publicEmail,
  publicName,
  publicPhone,
  publicWebsite,
} from "../../lib/public-contacts.ts";
import type { ParsedFile } from "./files.ts";

const activities = {
  hospedagens: "Meio de Hospedagem",
  guias: "Guia de Turismo",
  gastronomia: "Restaurante, Cafeteria, Bar e Similares",
  transportes: "Transportadora Turística",
  agencias: "Agência de Turismo",
  servicos: "Prestador Especializado em Segmentos Turísticos",
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

export function hashRegistryRecord(record: RegistryData) {
  return createHash("sha256").update(JSON.stringify(record)).digest("hex");
}

export type NormalizedImportRows = {
  counts: Preview["counts"];
  issues: Preview["issues"];
  candidates: Map<string, { record: RegistryData; row: number }>;
};

export function normalizeImportRows(
  file: ParsedFile,
  options: ImportOptions,
): NormalizedImportRows {
  const activityIndex = file.headers.findIndex(
    (header) => normalizeLabel(header) === "atividadeturistica",
  );
  const cpfIndex = file.headers.findIndex((header) => normalizeLabel(header) === "cpf");
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
    const uf = get("uf").toUpperCase();
    const city = get("city");
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
      const name = publicName(get("name")) || publicName(get("fallback_name"));
      if (
        name.length < 2 ||
        name.length > 200 ||
        city.length < 2 ||
        city.length > 100 ||
        !states.includes(uf)
      )
        throw Error("Confira nome, município e sigla da UF.");
      const subtype = get("subtype");
      const registry_status = get("registry_status");
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
        phone: options.include_contacts ? publicPhone(get("phone")) : "",
        email: options.include_contacts ? publicEmail(get("email")) : "",
        address: options.include_contacts ? cleanPublicText(get("address")).slice(0, 500) : "",
        website: options.include_contacts ? publicWebsite(get("website")) : "",
        languages: cleanPublicText(get("languages")).slice(0, 500),
        units: /^\d{1,5}$/.test(get("units")) ? Number(get("units")) : null,
        beds: /^\d{1,5}$/.test(get("beds")) ? Number(get("beds")) : null,
      };
      if (conflicting.has(external_id)) {
        counts.conflicts++;
        issue(rowNumber, "Identificador repetido com dados divergentes; revise o arquivo.");
        return;
      }
      const previous = candidates.get(external_id);
      if (previous) {
        if (hashRegistryRecord(previous.record) === hashRegistryRecord(record)) counts.duplicates++;
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

  return { counts, issues, candidates };
}
