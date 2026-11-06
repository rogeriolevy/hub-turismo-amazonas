const baseAddress = process.argv[2] || process.env.SITE_URL;
const expectedVersion = process.env.APP_VERSION || process.env.npm_package_version;

if (!baseAddress) throw new Error("Informe SITE_URL ou a URL base do serviço.");
if (!expectedVersion) throw new Error("Informe APP_VERSION para conferir a versão publicada.");

const base = new URL(baseAddress);
if (
  !["http:", "https:"].includes(base.protocol) ||
  base.username ||
  base.password ||
  base.search ||
  base.hash
)
  throw new Error("A URL de saúde precisa ser HTTP(S), sem credenciais, query ou fragmento.");

const healthUrl = new URL("/api/health", base);
let lastObservation = "sem resposta";

for (let attempt = 1; attempt <= 12; attempt += 1) {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(3500) });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      // The endpoint may still be starting or a proxy may be returning an error page.
    }

    const status =
      payload && typeof payload === "object" && "status" in payload ? payload.status : null;
    const version =
      payload && typeof payload === "object" && "version" in payload ? payload.version : null;
    const database =
      payload && typeof payload === "object" && "database" in payload ? payload.database : null;

    if (
      response.ok &&
      status === "ok" &&
      version === expectedVersion &&
      database === "postgresql"
    ) {
      console.log(`Saúde confirmada: PostgreSQL disponível e versão ${expectedVersion}.`);
      process.exitCode = 0;
      break;
    }

    lastObservation = `HTTP ${response.status}; saúde ${status === "ok" ? "ok" : "pendente"}; PostgreSQL ${database === "postgresql" ? "confirmado" : "não confirmado"}; versão ${version === expectedVersion ? "correta" : "diferente"}`;
    if (response.status >= 400 && response.status < 500 && response.status !== 429)
      throw new Error(lastObservation);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("HTTP ")) throw error;
    lastObservation = "serviço ainda não respondeu";
  }

  if (attempt < 12) await new Promise((resolve) => setTimeout(resolve, 1500));
}

if (process.exitCode !== 0)
  throw new Error(
    `Healthcheck não confirmou banco e versão após 12 tentativas (${lastObservation}).`,
  );
