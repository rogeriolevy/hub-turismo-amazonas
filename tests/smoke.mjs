import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:5173";
for (const path of [
  "/",
  "/privacidade",
  "/admin",
  "/api/health",
  "/api/openapi",
  "/robots.txt",
  "/sitemap.xml",
]) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200, path);
  console.log("OK", path);
}
const denied = await fetch(base + "/api/admin/contatos");
assert.equal(denied.status, 401);
const invalid = await fetch(base + "/api/contatos", {
  method: "POST",
  headers: { "content-type": "application/json", origin: base },
  body: "{}",
});
assert.equal(invalid.status, 422);
const cross = await fetch(base + "/api/contatos", {
  method: "POST",
  headers: { "content-type": "application/json", origin: "https://example.invalid" },
  body: "{}",
});
assert.equal(cross.status, 403);
const missing = await fetch(base + "/pagina-inexistente");
assert.equal(missing.status, 404);
console.log("OK authentication, validation, origin, 404");
