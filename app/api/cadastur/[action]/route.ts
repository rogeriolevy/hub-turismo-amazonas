import { z } from "zod";
import { getDatabase } from "@/db";
import { requireActor } from "@/server/platform-session";
import { requirePlatformAdmin } from "@/server/platform-access";
import { parse } from "@/server/platform-store";
import {
  assertOrigin,
  errorResponse,
  HttpError,
  json,
  readJson,
  readLimitedBody,
} from "@/server/http";
import { categorySchema, importOptionsSchema, MAX_FILE_BYTES } from "@/lib/cadastur-schema";
import { listResources, downloadResource, sourceInfo } from "@/server/cadastur/sources";
import { parseCadasturFile } from "@/server/cadastur/files";
import { createPreview, commitImport, reviewEntry, listDirectory } from "@/server/cadastur/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ action: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const actor = await requireActor();
    requirePlatformAdmin(actor);
    const { action } = await context.params;
    const query = Object.fromEntries(new URL(request.url).searchParams);
    if (action === "fontes")
      return json({ data: await listResources(parse(categorySchema, query.category)) });
    if (action === "registros") return json({ data: listDirectory(getDatabase(), actor, query) });
    throw new HttpError(404, "NOT_FOUND", "Operação não encontrada.");
  } catch (error) {
    return errorResponse(error, crypto.randomUUID());
  }
}
export async function POST(request: Request, context: Context) {
  try {
    const actor = await requireActor();
    requirePlatformAdmin(actor);
    const { action } = await context.params;
    if (action === "confirmar")
      return json({ data: commitImport(getDatabase(), actor, await readJson(request)) });
    if (action === "revisar")
      return json({ data: reviewEntry(getDatabase(), actor, await readJson(request)) });
    if (!["inspecionar", "prever"].includes(action))
      throw new HttpError(404, "NOT_FOUND", "Operação não encontrada.");
    assertOrigin(request);
    let input: unknown, uploaded: File | undefined;
    const contentType = request.headers.get("content-type") || "";
    if (contentType.startsWith("multipart/form-data;")) {
      const bytes = await readLimitedBody(request, MAX_FILE_BYTES + 24000);
      let form: FormData;
      try {
        form = await new Response(bytes, { headers: { "content-type": contentType } }).formData();
      } catch {
        throw new HttpError(400, "FILE_FORM", "Envio de arquivo inválido.");
      }
      const file = form.get("file"),
        config = form.get("config");
      if (!(file instanceof File) || typeof config !== "string" || config.length > 12000)
        throw new HttpError(422, "FILE_FORM", "Selecione um arquivo e configure a importação.");
      uploaded = file;
      try {
        input = JSON.parse(config);
      } catch {
        throw new HttpError(400, "FILE_FORM", "Configuração inválida.");
      }
    } else input = await readJson(request);
    const base = parse(
      z
        .object({
          category: categorySchema,
          sheet: z.string().min(1).max(100).default("1"),
          resource_id: z.string().uuid().optional(),
        })
        .passthrough(),
      input,
    );
    if (uploaded && base.resource_id)
      throw new HttpError(422, "SOURCE", "Escolha arquivo local ou recurso oficial.");
    if (!uploaded && !base.resource_id)
      throw new HttpError(422, "SOURCE", "Selecione um arquivo ou recurso oficial.");
    const sourceFile = uploaded
      ? {
          bytes: new Uint8Array(await uploaded.arrayBuffer()),
          format: uploaded.name.split(".").at(-1)?.toLowerCase() || "",
          source: sourceInfo(base.category),
          period: null,
        }
      : await downloadResource(base.category, base.resource_id!);
    const file = await parseCadasturFile(sourceFile.bytes, sourceFile.format, base.sheet);
    if (action === "inspecionar") {
      const { data: _rows, ...inspection } = file;
      void _rows;
      return json({
        data: { ...inspection, period: sourceFile.period, source: sourceFile.source },
      });
    }
    const { resource_id: _resource, ...optionsInput } = base;
    void _resource;
    const options = parse(importOptionsSchema, optionsInput);
    if (sourceFile.period && options.period !== sourceFile.period)
      throw new HttpError(422, "PERIOD", "O período deve corresponder ao recurso oficial.");
    return json({ data: createPreview(getDatabase(), actor, file, options, sourceFile.source) });
  } catch (error) {
    return errorResponse(error, crypto.randomUUID());
  }
}
