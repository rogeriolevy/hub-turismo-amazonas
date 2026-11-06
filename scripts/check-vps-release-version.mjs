import { readFileSync } from "node:fs";

const packageInfo = JSON.parse(readFileSync("package.json", "utf8"));
const exampleEnv = readFileSync("infra/vps.env.example", "utf8");
const configuredVersion = /^APP_VERSION=(\S+)\s*$/m.exec(exampleEnv)?.[1];

if (!configuredVersion)
  throw new Error(
    "APP_VERSION ausente em infra/vps.env.example; configure a etiqueta da imagem VPS.",
  );
if (configuredVersion !== packageInfo.version)
  throw new Error(
    `APP_VERSION (${configuredVersion}) difere da versão do package.json (${packageInfo.version}).`,
  );

console.log(`Versão da imagem VPS alinhada ao projeto: ${packageInfo.version}.`);
