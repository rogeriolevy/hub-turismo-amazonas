export function isAdmin(email: string | null | undefined, allowlist: string | undefined) {
  if (!email || !allowlist?.trim()) return false;
  return allowlist
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}
