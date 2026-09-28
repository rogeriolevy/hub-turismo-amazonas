export class HttpError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string[] | undefined>;
  constructor(
    status: number,
    code: string,
    message: string,
    fields?: Record<string, string[] | undefined>,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}
export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers },
  });
}
export function errorResponse(error: unknown, requestId: string) {
  if (error instanceof HttpError)
    return json(
      { error: { code: error.code, message: error.message, fields: error.fields, requestId } },
      error.status,
      error.status === 429 ? { "Retry-After": "3600" } : {},
    );
  console.error(JSON.stringify({ event: "request_failed", requestId }));
  return json(
    {
      error: {
        code: "UNAVAILABLE",
        message:
          "Não foi possível concluir agora. Seus dados continuam no formulário. Tente novamente em instantes.",
        requestId,
      },
    },
    503,
  );
}
export async function readJson(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    throw new HttpError(403, "ORIGIN", "Origem do envio não autorizada.");
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    throw new HttpError(415, "CONTENT_TYPE", "Envie conteúdo JSON.");
  const max = 12000;
  if (Number(request.headers.get("content-length")) > max)
    throw new HttpError(413, "TOO_LARGE", "Mensagem excede o tamanho permitido.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "INVALID_JSON", "Conteúdo inválido.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new HttpError(413, "TOO_LARGE", "Mensagem excede o tamanho permitido.");
    }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Conteúdo JSON inválido.");
  }
}
