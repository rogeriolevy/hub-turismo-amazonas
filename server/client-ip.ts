import { isIP } from "node:net";
export function getClientIp(headers: Headers) {
  // Trust only a header explicitly overwritten by the proxy in front of Node.
  const trustedHeader = process.env.TRUST_PROXY_IP_HEADER;
  const candidate = trustedHeader ? headers.get(trustedHeader)?.trim() : undefined;
  return candidate && isIP(candidate) ? candidate : "127.0.0.1";
}
