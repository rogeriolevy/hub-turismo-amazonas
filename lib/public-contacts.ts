export function cleanPublicText(value: string) {
  const text = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return /^(?:[-*\s]+|n[aã]o informado|n[aã]o possui|null)$/i.test(text) ? "" : text;
}
export function publicName(value: string) {
  return cleanPublicText(value)
    .replace(/\b\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}\b/g, "")
    .replace(/^\d{2}\.\d{3}\.\d{3}\s+/, "")
    .trim();
}
export function publicPhone(value: string) {
  const digits = cleanPublicText(value).replace(/\D/g, "");
  if (/^[1-9]\d{9,10}$/.test(digits)) return "+55" + digits;
  return /^55[1-9]\d{9,10}$/.test(digits) ? "+" + digits : "";
}
export function displayPublicPhone(value: string) {
  const local = value.replace(/^\+55/, "");
  return local.length === 10 || local.length === 11
    ? `(${local.slice(0, 2)}) ${local.slice(2, -4)}-${local.slice(-4)}`
    : value;
}
export function publicEmail(value: string) {
  const email = cleanPublicText(value).toLowerCase();
  return email.length <= 254 &&
    /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(email)
    ? email
    : "";
}
export function publicWebsite(value: string) {
  const raw = cleanPublicText(value);
  if (!raw || /\s|[<>]/.test(raw) || (raw.includes(":") && !/^https?:\/\//i.test(raw))) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : "https://" + raw);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      !url.hostname.includes(".") ||
      /^[\d.]+$/.test(url.hostname) ||
      url.hostname.endsWith(".local")
    )
      return "";
    return url.href.length <= 500 ? url.href : "";
  } catch {
    return "";
  }
}
