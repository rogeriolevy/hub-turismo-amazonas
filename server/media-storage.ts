import { del, put } from "@vercel/blob";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const localCatalogImage = /^\/uploads\/catalog\/([a-f0-9-]{36}\.(?:jpg|png|webp))$/i;

function blobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
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

  const directory = resolve(process.cwd(), "public", "uploads", "catalog");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const destination = resolve(directory, name);
  await writeFile(destination, bytes, { flag: "wx", mode: 0o600 });
  return "/uploads/catalog/" + name;
}

export async function removeCatalogImage(url: string) {
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
