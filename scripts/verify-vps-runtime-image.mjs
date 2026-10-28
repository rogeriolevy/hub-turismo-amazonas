import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const usage = "Uso: node scripts/verify-vps-runtime-image.mjs --manifest <manifest.json>";
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--manifest" || !args[1])
  throw new Error(usage);

const manifestPath = resolve(args[1]);
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (error) {
  throw new Error(`Não foi possível ler o manifesto indicado: ${manifestPath}`, { cause: error });
}

const version = manifest.appVersion;
const expectedTag = `hub-turismo-amazonas:${version}`;
const maximumImageBytes = 550_000_000;
if (!/^\d+\.\d+\.\d+$/.test(version ?? ""))
  throw new Error("O manifesto precisa declarar appVersion no formato major.minor.patch.");
if (manifest.status !== "local-candidate-not-deployed")
  throw new Error("O manifesto não identifica uma candidata exclusivamente local.");
if (manifest.imageTag !== expectedTag || manifest.composeExpectedTag !== expectedTag)
  throw new Error(`A etiqueta da imagem precisa ser ${expectedTag} no manifesto e no Compose.`);
if (!/^sha256:[a-f0-9]{64}$/.test(manifest.imageId ?? ""))
  throw new Error("O manifesto não contém um ID Docker SHA-256 válido.");
if (!Number.isSafeInteger(manifest.imageBytes) || manifest.imageBytes < 1)
  throw new Error("O manifesto não contém o tamanho da imagem Docker.");
if (manifest.imageBytes > maximumImageBytes)
  throw new Error(`A imagem ${expectedTag} excede o limite de ${maximumImageBytes} bytes.`);
if (manifest.runtimeUser !== "node")
  throw new Error(`O runtime esperado para ${expectedTag} precisa usar o usuário node.`);

const metadata = runDocker([
  "image",
  "inspect",
  "--format",
  "{{.Id}}|{{.Size}}|{{.Config.User}}",
  expectedTag,
]).split("|");
const [imageId, sizeText, runtimeUser] = metadata;
const imageSizeText = Number(sizeText).toLocaleString("pt-BR");
if (imageId !== manifest.imageId || Number(sizeText) !== manifest.imageBytes || runtimeUser !== "node")
  throw new Error(`A imagem local ${expectedTag} diverge do ID, tamanho ou usuário registrados no manifesto.`);

const runtimeInspection = String.raw`
const fs = require("node:fs");
const path = require("node:path");
const app = JSON.parse(fs.readFileSync("/app/package.json", "utf8"));
const modulesRoot = "/app/node_modules";
const forbidden = new Set([
  "eslint-config-next",
  "@next/eslint-plugin-next",
  "fast-glob",
  "micromatch",
  "braces",
]);
const foundForbidden = [];
const missingDirect = Object.keys(app.dependencies || {}).filter(
  (name) => !fs.existsSync(path.join(modulesRoot, name, "package.json")),
);
const healthcheckScriptPresent = fs.existsSync("/app/scripts/check-runtime.mjs");
let packageCount = 0;

function inspectPackage(directory, name) {
  const packagePath = path.join(directory, "package.json");
  if (!fs.existsSync(packagePath)) return;
  packageCount += 1;
  if (forbidden.has(name)) foundForbidden.push(path.relative(modulesRoot, directory));
  inspectModules(path.join(directory, "node_modules"));
}

function inspectModules(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error("Link simbólico inesperado no runtime.");
    if (!entry.isDirectory()) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.name.startsWith("@")) {
      for (const scoped of fs.readdirSync(entryPath, { withFileTypes: true })) {
        if (scoped.isSymbolicLink()) throw new Error("Link simbólico inesperado no runtime.");
        if (scoped.isDirectory())
          inspectPackage(path.join(entryPath, scoped.name), entry.name + "/" + scoped.name);
      }
    } else {
      inspectPackage(entryPath, entry.name);
    }
  }
}

if (app.version !== EXPECTED_VERSION)
  throw new Error("Versão interna da aplicação divergente da etiqueta da imagem.");
if (Object.hasOwn(app, "devDependencies"))
  throw new Error("O manifesto runtime ainda contém devDependencies.");
if (fs.existsSync("/app/package-lock.json"))
  throw new Error("O lockfile de desenvolvimento foi incluído no runtime.");
if (missingDirect.length)
  throw new Error("Dependências diretas ausentes: " + missingDirect.join(", "));
if (!healthcheckScriptPresent)
  throw new Error("O script de runtime check está ausente da imagem.");
inspectModules(modulesRoot);
if (foundForbidden.length)
  throw new Error("Cadeia de lint presente no runtime: " + foundForbidden.join(", "));
console.log(JSON.stringify({
  version: app.version,
  directDependencies: Object.keys(app.dependencies || {}).length,
  installedPackages: packageCount,
  devDependenciesPresent: false,
  packageLockPresent: false,
  healthcheckScriptPresent,
  forbiddenPackages: foundForbidden,
}));
`.replace("EXPECTED_VERSION", JSON.stringify(version));

const containerOutput = runDocker([
  "run",
  "--rm",
  "--network",
  "none",
  "--read-only",
  "--cap-drop",
  "ALL",
  "--security-opt",
  "no-new-privileges",
  "--entrypoint",
  "node",
  expectedTag,
  "-e",
  runtimeInspection,
]);
const runtime = JSON.parse(containerOutput);
if (runtime.version !== version)
  throw new Error(`A imagem contém a versão ${runtime.version}; o manifesto declara ${version}.`);

console.log(
  `Imagem VPS verificada: ${expectedTag}; ${imageSizeText} bytes; usuário node; ${runtime.directDependencies} dependências diretas; ${runtime.installedPackages} pacotes runtime; ID ${imageId}.`,
);
console.log(JSON.stringify(runtime));

function runDocker(dockerArgs) {
  try {
    return execFileSync("docker", dockerArgs, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const details = [error.stdout, error.stderr]
      .map((value) => (Buffer.isBuffer(value) ? value.toString("utf8") : value))
      .filter(Boolean)
      .join("\n")
      .trim();
    throw new Error(`Docker não conseguiu verificar ${expectedTag}.${details ? `\n${details}` : ""}`, {
      cause: error,
    });
  }
}
