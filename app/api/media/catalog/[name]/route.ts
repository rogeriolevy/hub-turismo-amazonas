import { getDatabase, one } from "@/db";
import { errorResponse } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function GET(request: Request) {
  try {
    const encodedName = new URL(request.url).pathname.split("/").at(-1) || "";
    const name = decodeURIComponent(encodedName);
    if (!/^[a-f0-9-]{36}\.(?:jpg|png|webp)$/i.test(name))
      return new Response(null, { status: 404 });

    const image = await one<{ content_type: string; content_base64: string }>(
      getDatabase(),
      "SELECT content_type,content_base64 FROM catalog_media WHERE name=?",
      name,
    );
    if (!image || !allowedTypes.has(image.content_type))
      return new Response(null, { status: 404 });

    return new Response(Buffer.from(image.content_base64, "base64"), {
      headers: {
        "Content-Type": image.content_type,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error, crypto.randomUUID());
  }
}
