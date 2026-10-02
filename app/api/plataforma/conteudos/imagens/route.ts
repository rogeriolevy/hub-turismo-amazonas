import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { requireActor } from "@/server/platform-session";
import { requirePlatformAdmin } from "@/server/platform-access";
import { assertOrigin, errorResponse, HttpError, json, readLimitedBody } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxFiles = 8;
const maxFileBytes = 5 * 1024 * 1024;
const maxRequestBytes = 16 * 1024 * 1024;

function extension(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "jpg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return "png";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  )
    return "webp";
  return null;
}

export async function POST(request: Request) {
  const saved: string[] = [];
  try {
    assertOrigin(request);
    const actor = await requireActor();
    requirePlatformAdmin(actor);
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data;"))
      throw new HttpError(415, "CONTENT_TYPE", "Envie imagens pelo formulário do catálogo.");
    const body = await readLimitedBody(request, maxRequestBytes);
    const form = await new Response(body, { headers: { "content-type": contentType } }).formData();
    const files = form.getAll("images").filter((entry): entry is File => entry instanceof File);
    if (!files.length || files.length > maxFiles)
      throw new HttpError(422, "IMAGE_COUNT", "Selecione de 1 a 8 imagens por envio.");

    let totalBytes = 0;
    const images: { bytes: Uint8Array; extension: string; name: string }[] = [];
    for (const file of files) {
      if (!file.size || file.size > maxFileBytes)
        throw new HttpError(413, "IMAGE_SIZE", "Cada imagem deve ter até 5 MB.");
      totalBytes += file.size;
      if (totalBytes > maxRequestBytes)
        throw new HttpError(413, "IMAGE_SIZE", "As imagens excedem o limite total de 16 MB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const ext = extension(bytes);
      if (!ext)
        throw new HttpError(415, "IMAGE_TYPE", "Envie somente imagens JPEG, PNG ou WebP válidas.");
      images.push({ bytes, extension: ext, name: crypto.randomUUID() + "." + ext });
    }

    const directory = resolve(process.cwd(), "public", "uploads", "catalog");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    for (const image of images) {
      const destination = resolve(directory, image.name);
      await writeFile(destination, image.bytes, { flag: "wx", mode: 0o600 });
      saved.push(destination);
    }
    return json({ data: { images: images.map((image) => "/uploads/catalog/" + image.name) } }, 201);
  } catch (error) {
    await Promise.all(saved.map((path) => rm(path, { force: true }).catch(() => undefined)));
    return errorResponse(error, crypto.randomUUID());
  }
}
