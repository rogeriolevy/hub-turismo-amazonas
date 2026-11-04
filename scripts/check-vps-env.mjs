import { readFileSync, statSync } from "node:fs";

const errors = [];
const value = (name) => process.env[name]?.trim() ?? "";
const required = [
  "SITE_URL",
  "APP_VERSION",
  "BETTER_AUTH_SECRET",
  "ADMIN_EMAILS",
  "TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
  "POSTGRES_DB",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "HUB_DB_USER",
  "HUB_DB_PASSWORD",
];
const reservedHosts = [
  "localhost",
  "127.0.0.1",
  "[::1]",
  "example.com",
  "example.org",
  "example.net",
];
const isExampleHost = (host) =>
  reservedHosts.includes(host) ||
  /\.(?:example\.com|example\.org|example\.net|example|test|invalid|localhost|local)$/.test(host);

for (const name of required) {
  const current = value(name);
  if (!current) errors.push(`${name} está vazio.`);
  else if (/^(REPLACE_WITH_|GENERATE_A_RANDOM_|YOUR_)/i.test(current))
    errors.push(`${name} ainda contém o valor de exemplo.`);
}

try {
  const site = new URL(value("SITE_URL"));
  if (
    site.protocol !== "https:" ||
    site.pathname !== "/" ||
    site.search ||
    site.hash ||
    site.username ||
    site.password ||
    isExampleHost(site.hostname)
  )
    errors.push("SITE_URL precisa ser a origem HTTPS real, sem caminho, query ou fragmento.");
} catch {
  errors.push("SITE_URL não é uma URL válida.");
}

for (const name of ["OSM_NOMINATIM_URL", "OSM_OVERPASS_URL"]) {
  const endpoint = value(name);
  if (!endpoint) continue;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash)
      errors.push(`${name} precisa ser uma origem HTTPS sem credenciais, query ou fragmento.`);
  } catch {
    errors.push(`${name} não é uma URL válida.`);
  }
}

if (value("BETTER_AUTH_SECRET").length < 32)
  errors.push("BETTER_AUTH_SECRET precisa ter ao menos 32 caracteres.");

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value("APP_VERSION")))
  errors.push("APP_VERSION precisa ser uma versão SemVer usada para etiquetar a imagem VPS.");
const packagePath = process.argv[3];
if (packagePath) {
  try {
    const packageInfo = JSON.parse(readFileSync(packagePath, "utf8"));
    if (value("APP_VERSION") !== packageInfo.version)
      errors.push("APP_VERSION precisa corresponder à versão atual de package.json.");
  } catch {
    errors.push("Não foi possível conferir APP_VERSION com o package.json montado.");
  }
}

const adminEmails = value("ADMIN_EMAILS")
  .split(",")
  .map((email) => email.trim())
  .filter(Boolean);
if (
  adminEmails.length === 0 ||
  adminEmails.some(
    (email) => !/^[^\s@]+@[^\s@]+$/.test(email) || /@example\.(com|net|org)$/i.test(email),
  )
)
  errors.push("ADMIN_EMAILS precisa listar ao menos um e-mail administrativo real.");

const identifier = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
for (const name of ["POSTGRES_DB", "POSTGRES_USER", "HUB_DB_USER"])
  if (value(name) && !identifier.test(value(name)))
    errors.push(`${name} precisa ser um identificador simples de até 63 caracteres.`);
if (value("POSTGRES_USER") && value("POSTGRES_USER") === value("HUB_DB_USER"))
  errors.push("POSTGRES_USER e HUB_DB_USER precisam ser contas distintas.");

const hexSecret = /^(?:[a-f0-9]{2}){32,}$/i;
for (const name of ["POSTGRES_PASSWORD", "HUB_DB_PASSWORD"])
  if (value(name) && !hexSecret.test(value(name)))
    errors.push(
      `${name} precisa ser hexadecimal com ao menos 32 bytes; gere com openssl rand -hex 32.`,
    );
if (value("POSTGRES_PASSWORD") && value("POSTGRES_PASSWORD") === value("HUB_DB_PASSWORD"))
  errors.push("POSTGRES_PASSWORD e HUB_DB_PASSWORD precisam ser diferentes.");

const siteKey = value("TURNSTILE_SITE_KEY");
const secretKey = value("TURNSTILE_SECRET_KEY");
if (siteKey === "1x00000000000000000000AA" || secretKey === "1x0000000000000000000000000000000AA")
  errors.push("As chaves de teste do Turnstile não podem ser usadas na VPS.");

const smtp = {
  host: value("SMTP_HOST"),
  from: value("SMTP_FROM"),
  user: value("SMTP_USER"),
  password: value("SMTP_PASSWORD"),
};
const bookingEmailNotifications = value("BOOKING_EMAIL_NOTIFICATIONS").toLowerCase();
if (bookingEmailNotifications && !["true", "false"].includes(bookingEmailNotifications))
  errors.push("BOOKING_EMAIL_NOTIFICATIONS precisa ser true ou false.");
const smtpConfigured = Object.values(smtp).some(Boolean);
if (smtpConfigured && (!smtp.host || !smtp.from || Boolean(smtp.user) !== Boolean(smtp.password)))
  errors.push("SMTP requer host e remetente; usuário e senha devem ser informados juntos.");
for (const name of ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"])
  if (/^(REPLACE_WITH_|GENERATE_A_RANDOM_|YOUR_)/i.test(value(name)))
    errors.push(`${name} ainda contém um valor de exemplo.`);
if (smtp.host && isExampleHost(smtp.host.toLowerCase()))
  errors.push("SMTP_HOST precisa apontar para o serviço transacional real.");
const smtpFromAddress = /<([^<>]+)>/.exec(smtp.from)?.[1] ?? smtp.from;
const smtpFromDomain = /^\s*[^\s@]+@([^\s@]+)\s*$/.exec(smtpFromAddress)?.[1]?.toLowerCase();
if (smtp.from && !smtpFromDomain)
  errors.push("SMTP_FROM precisa conter um endereço de e-mail válido.");
if (smtpFromDomain && isExampleHost(smtpFromDomain))
  errors.push("SMTP_FROM precisa usar um remetente de domínio real.");
if (bookingEmailNotifications === "true" && !smtpConfigured)
  errors.push("SMTP precisa estar configurado para ativar e-mails de reservas.");
const smtpPort = value("SMTP_PORT");
if (smtpPort && (!/^\d+$/.test(smtpPort) || Number(smtpPort) < 1 || Number(smtpPort) > 65535))
  errors.push("SMTP_PORT precisa estar entre 1 e 65535.");

const requireVerification = value("REQUIRE_EMAIL_VERIFICATION").toLowerCase();
if (requireVerification && !["true", "false"].includes(requireVerification))
  errors.push("REQUIRE_EMAIL_VERIFICATION precisa ser true ou false.");
if (requireVerification === "true" && !smtpConfigured)
  errors.push("SMTP precisa estar configurado antes de exigir confirmação de e-mail.");

const envFilePath = process.argv[2];
if (envFilePath && process.platform !== "win32") {
  try {
    const mode = statSync(envFilePath).mode & 0o777;
    if (mode & 0o077)
      errors.push(
        "O arquivo de ambiente permite leitura/escrita por grupo ou terceiros; use chmod 600.",
      );
  } catch {
    errors.push("Não foi possível verificar as permissões do arquivo de ambiente montado.");
  }
}

if (errors.length) {
  console.error("Pré-checagem da VPS falhou:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Configuração VPS validada; valores secretos não foram exibidos.");
}
