import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import {
  CATALOG_MEDIA_LIMIT as mediaLimit,
  CATALOG_MEDIA_NAME_PATTERN as mediaPattern,
  detectCatalogImageType as detectImageType,
  expectedCatalogImageType as expectedImageType,
  type CatalogMediaManifest,
} from "./catalog-media-manifest.ts";

const localMediaUrl = /^\/uploads\/catalog\/([a-f0-9-]{36}\.(?:jpg|png|webp))$/i;
const databaseMediaUrl = /^\/api\/media\/catalog\/([a-f0-9-]{36}\.(?:jpg|png|webp))$/i;

export type SqliteRow = Record<string, string | number | bigint | Buffer | null>;

type LocalMedia = {
  name: string;
  path: string;
  contentType: string;
  createdAt: string;
  sha256: string;
};

export function validateStoredMediaRows(rows: SqliteRow[]) {
  for (const row of rows) {
    const name = row.name;
    const contentType = row.content_type;
    const encoded = row.content_base64;
    if (typeof name !== "string" || !mediaPattern.test(name))
      throw new Error("Uma imagem armazenada no SQLite tem nome inválido.");
    if (typeof encoded !== "string")
      throw new Error(`A imagem armazenada ${name} não contém Base64 válido.`);

    const bytes = Buffer.from(encoded, "base64");
    const expectedType = expectedImageType(name);
    if (
      !bytes.length ||
      bytes.length > mediaLimit ||
      bytes.toString("base64") !== encoded ||
      !expectedType ||
      contentType !== expectedType ||
      detectImageType(bytes) !== expectedType
    )
      throw new Error(`A imagem armazenada ${name} está inválida ou excede 5 MB.`);
  }
  return rows;
}

export async function readLocalMedia(
  directory: string,
  sourceNames: Set<string>,
  manifest: CatalogMediaManifest,
) {
  const files = await readdir(directory, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT")
      throw new Error(
        `A pasta de imagens locais não existe: ${directory}. Se não houver imagens, forneça uma pasta vazia explicitamente.`,
      );
    throw error;
  });
  const media: LocalMedia[] = [];
  const names = new Set(sourceNames);
  const manifestEntries = new Map(manifest.media.map((entry) => [entry.name, entry]));

  for (const entry of files) {
    if (!entry.isFile() || !mediaPattern.test(entry.name))
      throw new Error(`Arquivo inesperado em ${directory}: ${entry.name}`);
    if (names.has(entry.name))
      throw new Error(`Imagem duplicada entre o banco SQLite e os arquivos: ${entry.name}`);

    const path = resolve(directory, entry.name);
    const metadata = await lstat(path);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > mediaLimit)
      throw new Error(`Imagem inválida ou acima de 5 MB: ${entry.name}`);
    const bytes = await readFile(path);
    const contentType = detectImageType(bytes);
    if (!contentType || contentType !== expectedImageType(entry.name))
      throw new Error(`A extensão não corresponde ao conteúdo da imagem: ${entry.name}`);
    const manifestEntry = manifestEntries.get(entry.name);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (
      !manifestEntry ||
      bytes.length !== manifestEntry.size ||
      contentType !== manifestEntry.contentType ||
      sha256 !== manifestEntry.sha256
    )
      throw new Error(`A imagem não corresponde ao manifesto do backup: ${entry.name}`);

    names.add(entry.name);
    media.push({
      name: entry.name,
      path,
      contentType,
      createdAt: manifestEntry.createdAt,
      sha256,
    });
  }

  if (media.length !== manifest.media.length)
    throw new Error("A pasta de imagens e o manifesto do backup têm arquivos diferentes.");

  return { media, names };
}

export async function readLocalMediaBytes(media: LocalMedia) {
  const metadata = await lstat(media.path);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > mediaLimit)
    throw new Error(`Imagem inválida ou acima de 5 MB: ${media.name}`);
  const bytes = await readFile(media.path);
  if (bytes.length > mediaLimit) throw new Error(`Imagem inválida ou acima de 5 MB: ${media.name}`);
  if (
    detectImageType(bytes) !== media.contentType ||
    media.contentType !== expectedImageType(media.name) ||
    createHash("sha256").update(bytes).digest("hex") !== media.sha256
  )
    throw new Error(`A imagem foi alterada durante a transferência: ${media.name}`);
  return bytes;
}

export function transformCatalogRows(rows: SqliteRow[], mediaNames: Set<string>) {
  return rows.map((row) => {
    const rawUrls = row.image_urls_json;
    if (typeof rawUrls !== "string")
      throw new Error("Um item do catálogo tem image_urls_json inválido.");
    let urls: unknown;
    try {
      urls = JSON.parse(rawUrls);
    } catch {
      throw new Error("Um item do catálogo tem image_urls_json inválido.");
    }
    if (!Array.isArray(urls) || urls.some((url) => typeof url !== "string"))
      throw new Error("Um item do catálogo tem uma lista de imagens inválida.");

    const updatedUrls = urls.map((url) => {
      const localMatch = localMediaUrl.exec(url);
      if (localMatch) {
        if (!mediaNames.has(localMatch[1]))
          throw new Error(`Imagem referenciada não encontrada: ${localMatch[1]}`);
        return "/api/media/catalog/" + localMatch[1];
      }
      const databaseMatch = databaseMediaUrl.exec(url);
      if (databaseMatch && !mediaNames.has(databaseMatch[1]))
        throw new Error(`Imagem do banco referenciada não encontrada: ${databaseMatch[1]}`);
      return url;
    });

    return { ...row, image_urls_json: JSON.stringify(updatedUrls) };
  });
}
