import { getDatabase } from "@/db";
import { createContact } from "@/server/contact-service";
import { getClientIp } from "@/server/client-ip";
import { readJson, json, errorResponse } from "@/server/http";
export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const body = await readJson(request);
    const result = await createContact(
      getDatabase(),
      body,
      request.headers.get("Idempotency-Key"),
      getClientIp(request.headers),
    );
    return json(
      {
        data: {
          id: result.id,
          message: "Mensagem recebida. Obrigado por fazer parte dessa conversa!",
        },
      },
      result.duplicate ? 200 : 201,
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
