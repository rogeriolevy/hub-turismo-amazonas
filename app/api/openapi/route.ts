import specification from "@/docs/openapi.json";
export async function GET() {
  return Response.json(specification, {
    headers: { "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}
