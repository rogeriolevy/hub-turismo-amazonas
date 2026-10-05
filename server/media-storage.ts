import { del, put } from "@vercel/blob";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getDatabase, run, write } from "../db/index.ts";

const localCatalogImage = /^\/uploads\/catalog\/([a-f0-9-]{36}\.(?:jpg|png|webp))$/i;
const databaseCatalogImage = /^\/api\/media\/catalog\/([a-f0-9-]{36}\.(?:jpg|png|webp))$/i;

function blobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function postgresCatalogStorageConfigured() {
  return (
    process.env.CATALOG_MEDIA_STORAGE === "postgres" &&
    Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL)
  );
}

export function assertMediaStorageConfigured() {
  if (process.env.VERCEL && !blobConfigured())
    throw new Error("Configure BLOB_READ_WRITE_TOKEN para armazenar imagens na Vercel.");
}

export async function saveCatalogImage(name: string, bytes: Uint8Array, contentType: string) {
  assertMediaStorageConfigured();
  if (blobConfigured()) {
    const blob = await put("catalog/" + name, Buffer.from(bytes), {
      access: "public",
      addRandomSuffix: false,
      contentType,
    });
    return blob.url;
  }

  if (postgresCatalogStorageConfigured()) {
    await write(getDatabase(), async (transaction) => {
      await run(
        transaction,
        "INSERT INTO catalog_media (name,content_type,content_base64,created_at) VALUES (?,?,?,?)",
        name,
        contentType,
        Buffer.from(bytes).toString("base64"),
        new Date().toISOString(),
      );
    });
    return "/api/media/catalog/" + name;
  }

  const directory = resolve(process.cwd(), "public", "uploads", "catalog");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const destination = resolve(directory, name);
  await writeFile(destination, bytes, { flag: "wx", mode: 0o600 });
  return "/uploads/catalog/" + name;
}

export async function removeCatalogImage(url: string) {
  const databaseMatch = databaseCatalogImage.exec(url);
  if (databaseMatch && postgresCatalogStorageConfigured()) {
    await run(getDatabase(), "DELETE FROM catalog_media WHERE name=?", databaseMatch[1]);
    return;
  }

  const match = localCatalogImage.exec(url);
  if (match) {
    await rm(resolve(process.cwd(), "public", "uploads", "catalog", match[1]), {
      force: true,
    }).catch(() => undefined);
    return;
  }

  if (blobConfigured() && /^https:\/\/[^/]+\.public\.blob\.vercel-storage\.com\//i.test(url))
    await del(url);
}

export async function removeCatalogImages(urls: string[]) {
  await Promise.all(urls.map((url) => removeCatalogImage(url).catch(() => undefined)));
}
