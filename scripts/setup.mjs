import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
const path = ".env.local";
if (existsSync(path)) {
  console.log("Configuração existente preservada.");
} else {
  writeFileSync(
    path,
    [
      "SITE_URL=http://127.0.0.1:3005",
      "DATABASE_PATH=./data/hub.sqlite",
      "BETTER_AUTH_SECRET=" + randomBytes(48).toString("base64url"),
      "ADMIN_EMAILS=rogerio1kg@gmail.com",
      "TRUST_PROXY_IP_HEADER=",
      "",
    ].join("\n"),
    { flag: "wx", mode: 0o600 },
  );
  console.log("Configuração local criada. O segredo foi gerado e não será exibido.");
}
