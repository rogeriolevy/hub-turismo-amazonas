const DEFAULT_DESTINATION = "/minha-conta";
const ALLOWED_PATH =
  /^\/(?:minha-conta(?:\/reservas)?|painel\/(?:hotel|passeios|plataforma)|hospedagens\/[a-z0-9-]+|passeios\/[a-z0-9-]+)$/;

export function safeAuthDestination(value?: string | string[]) {
  if (
    typeof value !== "string" ||
    value.length > 1200 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return DEFAULT_DESTINATION;
  }

  try {
    const url = new URL(value, "https://hub.local");
    if (url.origin !== "https://hub.local" || !ALLOWED_PATH.test(url.pathname)) {
      return DEFAULT_DESTINATION;
    }
    return url.pathname + url.search;
  } catch {
    return DEFAULT_DESTINATION;
  }
}
