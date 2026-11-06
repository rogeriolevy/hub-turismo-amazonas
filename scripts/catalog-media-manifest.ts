import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

export const CATALOG_MEDIA_NAME_PATTERN = /^([a-f0-9-]{36}\.(?:jpg|png|webp))$/i;
export const CATALOG_MEDIA_LIMIT = 5 * 1024 * 1024;

export type CatalogMediaManifestEntry = {
  name: string;
  size: number;
  contentType: string;
  createdAt: string;
  sha256: string;
};

export type CatalogMediaManifest = {
  version: 1;
  databaseSha256: string;
  media: CatalogMediaManifestEntry[];
};

export function detectCatalogImageType(bytes: Buffer) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
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
    return "image/png";
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  return null;
}

export function expectedCatalogImageType(name: string) {
  const extension = name.split(".").at(-1)?.toLowerCase();
  return extension === "jpg"
    ? "image/jpeg"
    : extension === "png"
      ? "image/png"
      : extension === "webp"
        ? "image/webp"
        : null;
}

export async function sha256File(path: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

export async function createCatalogMediaManifest(
  databasePath: string,
  directory: string,
): Promise<CatalogMediaManifest> {
  const files = await readdir(directory, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const media: CatalogMediaManifestEntry[] = [];

  for (const entry of files) {
    if (!entry.isFile() || !CATALOG_MEDIA_NAME_PATTERN.test(entry.name))
      throw new Error(`Arquivo inesperado na pasta de imagens locais: ${entry.name}`);

    const path = join(directory, entry.name);
    const metadata = await lstat(path);
    if (
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      metadata.size < 1 ||
      metadata.size > CATALOG_MEDIA_LIMIT
    )
      throw new Error(`Imagem inválida ou acima de 5 MB: ${entry.name}`);

    const bytes = await readFile(path);
    const contentType = detectCatalogImageType(bytes);
    if (!contentType || contentType !== expectedCatalogImageType(entry.name))
      throw new Error(`A extensão não corresponde ao conteúdo da imagem: ${entry.name}`);

    media.push({
      name: entry.name,
      size: bytes.length,
      contentType,
      createdAt: metadata.birthtime.toISOString(),
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }

  media.sort((left, right) => left.name.localeCompare(right.name));
  return { version: 1, databaseSha256: await sha256File(databasePath), media };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseCatalogMediaManifest(value: unknown): CatalogMediaManifest {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.databaseSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.databaseSha256) ||
    !Array.isArray(value.media)
  )
    throw new Error("Manifesto de imagens inválido ou incompatível.");

  const names = new Set<string>();
  const media = value.media.map((entry): CatalogMediaManifestEntry => {
    if (
      !isRecord(entry) ||
      typeof entry.name !== "string" ||
      !CATALOG_MEDIA_NAME_PATTERN.test(entry.name) ||
      !Number.isInteger(entry.size) ||
      (entry.size as number) < 1 ||
      (entry.size as number) > CATALOG_MEDIA_LIMIT ||
      typeof entry.contentType !== "string" ||
      entry.contentType !== expectedCatalogImageType(entry.name) ||
      typeof entry.createdAt !== "string" ||
      !Number.isFinite(Date.parse(entry.createdAt)) ||
      new Date(entry.createdAt).toISOString() !== entry.createdAt ||
      typeof entry.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(entry.sha256) ||
      names.has(entry.name)
    )
      throw new Error("Uma entrada do manifesto de imagens é inválida ou duplicada.");
    names.add(entry.name);
    return {
      name: entry.name,
      size: entry.size as number,
      contentType: entry.contentType,
      createdAt: entry.createdAt,
      sha256: entry.sha256,
    };
  });

  return { version: 1, databaseSha256: value.databaseSha256, media };
}

export async function readCatalogMediaManifest(path: string) {
  let contents: string;
  try {
    contents = await readFile(path, "utf8");
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return null;
    throw error;
  }
  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch {
    throw new Error(`O manifesto de imagens não contém JSON válido: ${path}`);
  }
  return parseCatalogMediaManifest(value);
}
