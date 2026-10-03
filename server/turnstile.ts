const developmentSiteKey = "1x00000000000000000000AA";
const developmentSecretKey = "1x0000000000000000000000000000000AA";

function configuredKeys() {
  const siteKey = process.env.TURNSTILE_SITE_KEY?.trim() ?? "";
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim() ?? "";
  if (siteKey || secretKey) return { siteKey, secretKey };
  return process.env.NODE_ENV === "development"
    ? { siteKey: developmentSiteKey, secretKey: developmentSecretKey }
    : { siteKey: "", secretKey: "" };
}

export function isTurnstileConfigured() {
  const keys = configuredKeys();
  return Boolean(keys.siteKey && keys.secretKey);
}

export function turnstileSiteKey() {
  const keys = configuredKeys();
  return keys.siteKey && keys.secretKey ? keys.siteKey : "";
}

export function turnstileSecretKey() {
  const keys = configuredKeys();
  return keys.siteKey && keys.secretKey ? keys.secretKey : "";
}

export function captchaRequired() {
  return process.env.NODE_ENV === "production" || isTurnstileConfigured();
}

export function captchaUnavailableMessage() {
  return "A verificação antirobô ainda não foi configurada neste ambiente.";
}
