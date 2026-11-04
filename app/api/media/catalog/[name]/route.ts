import { errorResponse } from "@/server/http";
import { readCatalogImage } from "@/server/media-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const encodedName = new URL(request.url).pathname.split("/").at(-1) || "";
    const name = decodeURIComponent(encodedName);
    const image = await readCatalogImage(name);
    if (!image) return new Response(null, { status: 404 });

    return new Response(image.bytes, {
      headers: {
        "Content-Type": image.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error, crypto.randomUUID());
  }
}
