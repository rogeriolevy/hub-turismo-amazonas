import { z } from "zod";

export const cadasturSources = {
  hospedagens: { label: "Hospedagens", dataset: "meios-de-hospedagem" },
  guias: {
    label: "Guias de turismo",
    dataset: "prestadores-de-servicos-turisticos-guia-turismo_2",
  },
  gastronomia: {
    label: "Bares, restaurantes e cafeterias",
    dataset: "restaurantes-cafeterias-e-bares",
  },
  transportes: { label: "Transportadoras turísticas", dataset: "transportadora-turistica" },
  agencias: { label: "Agências de turismo", dataset: "agencia-de-turismo" },
  servicos: {
    label: "Serviços especializados",
    dataset: "prestador-especializado-em-segmentos-turisticos",
  },
} as const;
export const categorySchema = z.enum([
  "hospedagens",
  "guias",
  "gastronomia",
  "transportes",
  "agencias",
  "servicos",
]);
export type CadasturCategory = z.infer<typeof categorySchema>;
export const states =
  "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
export const fieldLabels = {
  external_id: "Certificado Cadastur ou CNPJ (nunca CPF)",
  name: "Nome para exibição (prefira Nome Fantasia)",
  fallback_name: "Razão social ou nome alternativo, se o principal estiver vazio",
  uf: "UF",
  city: "Município",
  subtype: "Tipo / categoria na fonte",
  registry_status: "Situação cadastral",
  valid_until: "Validade do certificado",
  phone: "Telefone comercial ou institucional",
  email: "E-mail comercial ou institucional",
  address: "Endereço comercial",
  website: "Site divulgado",
  languages: "Idiomas",
  units: "Unidades habitacionais",
  beds: "Leitos",
} as const;
export type MappingField = keyof typeof fieldLabels;
const column = z.number().int().min(-1).max(99);
export const mappingSchema = z
  .object({
    external_id: column.min(0),
    name: column.min(0),
    uf: column.min(0),
    city: column.min(0),
    fallback_name: column.default(-1),
    subtype: column.default(-1),
    registry_status: column.default(-1),
    valid_until: column.default(-1),
    phone: column.default(-1),
    email: column.default(-1),
    address: column.default(-1),
    website: column.default(-1),
    languages: column.default(-1),
    units: column.default(-1),
    beds: column.default(-1),
  })
  .strict();
export type ColumnMapping = z.infer<typeof mappingSchema>;
export const importOptionsSchema = z
  .object({
    category: categorySchema,
    period: z.string().regex(/^20\d{2}-T[1-4]$/, "Use o formato 2026-T2."),
    uf: z.string().refine((v) => states.includes(v), "Selecione uma UF."),
    city: z.string().trim().max(100).default(""),
    sheet: z.string().trim().min(1).max(100).default("1"),
    mapping: mappingSchema,
    include_contacts: z.boolean().default(false),
    checksum: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type ImportOptions = z.infer<typeof importOptionsSchema>;
export type SourceResource = {
  id: string;
  name: string;
  format: string;
  url: string;
  period: string;
  size: number | null;
};
export type SourceInfo = {
  category: CadasturCategory;
  dataset: string;
  url: string;
  resource_id: string | null;
  license: string;
  verified: boolean;
};
export type RegistryData = {
  external_id: string;
  name: string;
  uf: string;
  city: string;
  subtype: string;
  registry_status: string;
  valid_until: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  languages: string;
  units: number | null;
  beds: number | null;
};
export type ImportCounts = {
  total: number;
  filtered: number;
  invalid: number;
  duplicates: number;
  conflicts: number;
  older: number;
  added: number;
  updated: number;
  unchanged: number;
};
export type Preview = {
  id: string;
  counts: ImportCounts;
  records: (RegistryData & { action: string })[];
  issues: { row: number; message: string }[];
  expires_at: string;
  source: SourceInfo;
  period: string;
};
export type Inspection = {
  checksum: string;
  sheets: { name: string; rows: number }[];
  sheet: string;
  headers: string[];
  mapping: ColumnMapping;
  rows: number;
};
export type RegistryEntry = RegistryData & {
  id: string;
  category: CadasturCategory;
  period: string;
  company_id: string | null;
  guide_id: string | null;
  review_status: "pending" | "reviewed";
  imported_at: string;
  published: number;
};
export type ImportHistory = {
  id: string;
  category: CadasturCategory;
  period: string;
  created_at: string;
  status: string;
  summary: string;
};
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const normalizeLabel = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
export const isSensitiveColumn = (header: string) =>
  /cpf|email|telefone|nascimento|sanguineo|documentodeidentificacao|endere|responsavel/.test(
    normalizeLabel(header),
  );

const contactColumns: Partial<Record<MappingField, string[]>> = {
  phone: ["Telefone Comercial", "Telefone Institucional"],
  email: ["E-mail Comercial", "E-mail Institucional"],
  address: ["Endereço Completo Comercial", "Endereço Comercial"],
  website: ["Website", "Site", "Site Comercial"],
};
export function isAllowedMappingColumn(field: MappingField, header: string) {
  const allowed = contactColumns[field];
  return allowed
    ? allowed.some((name) => normalizeLabel(name) === normalizeLabel(header))
    : !isSensitiveColumn(header);
}

export function suggestMapping(headers: string[]): ColumnMapping {
  const normalized = headers.map(normalizeLabel);
  const find = (...labels: string[]) => {
    for (const label of labels) {
      const i = normalized.indexOf(normalizeLabel(label));
      if (i >= 0 && !isSensitiveColumn(headers[i])) return i;
    }
    return -1;
  };
  const name = find(
    "Nome Fantasia",
    "Nome Completo",
    "Nome",
    "Nome da Pessoa Jurídica",
    "Razão Social",
  );
  const fallback =
    ["Nome da Pessoa Jurídica", "Razão Social", "Nome Completo", "Nome"]
      .map((label) => find(label))
      .find((index) => index >= 0 && index !== name) ?? -1;
  const contact = (field: MappingField) => {
    for (const label of contactColumns[field] || []) {
      const index = normalized.indexOf(normalizeLabel(label));
      if (index >= 0) return index;
    }
    return -1;
  };
  return {
    external_id: find(
      "Número do Certificado",
      "Certificado",
      "Cadastur",
      "Número de Inscrição do CNPJ",
      "CNPJ",
    ),
    name,
    fallback_name: fallback,
    uf: find("UF", "Sigla UF"),
    city: find("Município", "Cidade"),
    subtype: find(
      "Tipo de Hospedagem",
      "Categoria(s)",
      "Categoria de Atuação",
      "Tipo",
      "Segmentos Turísticos",
      "Modalidades",
    ),
    registry_status: find("Situação Cadastral", "Situação"),
    valid_until: find("Validade do Certificado", "Validade"),
    phone: contact("phone"),
    email: contact("email"),
    address: contact("address"),
    website: contact("website"),
    languages: find("Idiomas"),
    units: find("Unidade Habitacionais", "Unidades Habitacionais"),
    beds: find("Leitos"),
  };
}
