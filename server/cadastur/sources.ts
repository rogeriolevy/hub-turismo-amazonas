import { z } from "zod";
import {
  cadasturSources,
  MAX_FILE_BYTES,
  type CadasturCategory,
  type SourceResource,
  type SourceInfo,
} from "../../lib/cadastur-schema.ts";
import { HttpError, readLimitedBody } from "../http.ts";
const origin = "https://dados.turismo.gov.br";
export function safeOfficialUrl(raw: string) {
  const url = new URL(raw);
  if (url.origin !== origin || url.username || url.password || url.hash)
    throw new HttpError(
      422,
      "SOURCE_URL",
      "A fonte deve pertencer ao portal oficial de dados do Ministério do Turismo.",
    );
  return url;
}
export function sourceInfo(category: CadasturCategory, resource?: SourceResource): SourceInfo {
  const dataset = cadasturSources[category].dataset;
  return {
    category,
    dataset,
    url: origin + "/pt_BR/dataset/" + dataset + (resource ? "/resource/" + resource.id : ""),
    resource_id: resource?.id || null,
    license: "ODbL-1.0",
    verified: !!resource,
  };
}
export function periodFromName(name: string) {
  const year = name.match(/20\d{2}/)?.[0];
  const quarter = name
    .toLowerCase()
    .match(/primeiro|segundo|terceiro|quarto|[1-4](?=\s*[º°o]?\s*trimestre)/)?.[0];
  const number = ["primeiro", "segundo", "terceiro", "quarto"].indexOf(quarter || "") + 1;
  return year && quarter ? `${year}-T${number || quarter}` : "";
}
async function officialFetch(url: string, max: number) {
  try {
    const response = await fetch(safeOfficialUrl(url), {
      redirect: "error",
      signal: AbortSignal.timeout(25000),
      cache: "no-store",
    });
    if (!response.ok) throw Error("HTTP");
    return await readLimitedBody(response, max);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      502,
      "SOURCE_UNAVAILABLE",
      "O portal do Ministério do Turismo não respondeu. Tente novamente ou envie o arquivo oficial.",
    );
  }
}
const metadataSchema = z.object({
  success: z.literal(true),
  result: z.object({
    license_id: z.literal("odc-odbl"),
    resources: z.array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        format: z.string(),
        url: z.string().url(),
        size: z.number().nullable().optional(),
      }),
    ),
  }),
});
export async function listResources(category: CadasturCategory): Promise<SourceResource[]> {
  const bytes = await officialFetch(
    origin + "/api/3/action/package_show?id=" + cadasturSources[category].dataset,
    2 * 1024 * 1024,
  );
  let parsed: z.infer<typeof metadataSchema>;
  try {
    parsed = metadataSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    throw new HttpError(
      502,
      "SOURCE_FORMAT",
      "O catálogo oficial retornou um formato inesperado. Use o envio de arquivo.",
    );
  }
  return parsed.result.resources
    .flatMap((resource) => {
      const format = resource.format.toLowerCase(),
        period = periodFromName(resource.name);
      if (!["csv", "xlsx"].includes(format) || !period) return [];
      try {
        safeOfficialUrl(resource.url);
      } catch {
        return [];
      }
      return [{ ...resource, size: resource.size ?? null, format, period }];
    })
    .sort((a, b) => b.period.localeCompare(a.period))
    .slice(0, 16);
}
export async function downloadResource(category: CadasturCategory, resourceId: string) {
  const resource = (await listResources(category)).find((r) => r.id === resourceId);
  if (!resource)
    throw new HttpError(
      422,
      "SOURCE_RESOURCE",
      "Selecione um arquivo listado para esta categoria.",
    );
  if (resource.size && resource.size > MAX_FILE_BYTES)
    throw new HttpError(413, "FILE_SIZE", "O recurso ultrapassa 20 MB. Envie uma seleção em CSV.");
  const bytes = await officialFetch(resource.url, MAX_FILE_BYTES);
  return {
    bytes,
    format: resource.format,
    source: sourceInfo(category, resource),
    period: resource.period,
  };
}
