import { existsSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const argument = process.argv[2];
if (!argument) throw new Error("Informe o diretório standalone a preparar.");

const runtimeRoot = resolve(process.cwd(), argument);
const packagePath = join(runtimeRoot, "package.json");
const lockPath = join(runtimeRoot, "package-lock.json");
const modulesRoot = join(runtimeRoot, "node_modules");
if (!existsSync(packagePath) || !existsSync(lockPath) || !existsSync(modulesRoot))
  throw new Error(
    "O runtime standalone está incompleto; pacote, lockfile e node_modules são obrigatórios.",
  );

const manifest = JSON.parse(readFileSync(packagePath, "utf8"));
const lock = JSON.parse(readFileSync(lockPath, "utf8"));
const lockedRoot = lock.packages?.[""];
if (manifest.version !== lock.version || manifest.version !== lockedRoot?.version)
  throw new Error("A versão do runtime não corresponde ao lockfile.");

const productionDependencies = Object.entries(manifest.dependencies ?? {});
for (const [name, range] of productionDependencies) {
  if (lockedRoot.dependencies?.[name] !== range)
    throw new Error(`A dependência de produção ${name} diverge do lockfile.`);
  const lockedPackage = lock.packages[`node_modules/${name}`];
  const installedPath = join(modulesRoot, name, "package.json");
  if (!lockedPackage?.version || !existsSync(installedPath))
    throw new Error(`Dependência de produção ausente no standalone: ${name}.`);
  if (lockedPackage.dev)
    throw new Error(
      `Dependência de produção ${name} está marcada como exclusiva de desenvolvimento.`,
    );
  const installed = JSON.parse(readFileSync(installedPath, "utf8"));
  if (installed.version !== lockedPackage.version)
    throw new Error(
      `A dependência ${name} está em ${installed.version}; o lockfile fixa ${lockedPackage.version}.`,
    );
}

const forbiddenPackages = new Set([
  "eslint-config-next",
  "@next/eslint-plugin-next",
  "fast-glob",
  "micromatch",
  "braces",
]);
const foundForbidden = [];
const removedDevelopmentPackages = [];

function inspectPackage(packageDirectory, packageName) {
  const packagePath = join(packageDirectory, "package.json");
  if (!existsSync(packagePath)) return;

  const packageRelativePath = relative(modulesRoot, packageDirectory).replaceAll("\\", "/");
  const lockKey = `node_modules/${packageRelativePath}`;
  const lockedPackage = lock.packages?.[lockKey];
  const installed = JSON.parse(readFileSync(packagePath, "utf8"));
  if (!lockedPackage?.version)
    throw new Error(`Dependência traçada ausente do lockfile: ${packageRelativePath}.`);
  if (installed.version !== lockedPackage.version)
    throw new Error(
      `A dependência traçada ${packageRelativePath} está em ${installed.version}; o lockfile fixa ${lockedPackage.version}.`,
    );

  if (lockedPackage.dev) {
    rmSync(packageDirectory, { recursive: true, force: true });
    removedDevelopmentPackages.push(packageRelativePath);
    return;
  }

  if (forbiddenPackages.has(packageName))
    foundForbidden.push(relative(runtimeRoot, packageDirectory).replaceAll("\\", "/"));
  inspectModules(join(packageDirectory, "node_modules"));
}

function inspectModules(directory) {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink())
      throw new Error(`Link simbólico inesperado em node_modules: ${join(directory, entry.name)}.`);
    if (!entry.isDirectory()) continue;
    const entryPath = join(directory, entry.name);
    if (entry.name.startsWith("@")) {
      for (const scopedPackage of readdirSync(entryPath, { withFileTypes: true })) {
        if (scopedPackage.isDirectory())
          inspectPackage(
            join(entryPath, scopedPackage.name),
            `${entry.name}/${scopedPackage.name}`,
          );
      }
    } else {
      inspectPackage(entryPath, entry.name);
    }
  }
}

inspectModules(modulesRoot);
if (foundForbidden.length)
  throw new Error(`Dependências de build permaneceram no runtime: ${foundForbidden.join(", ")}.`);

for (const [name] of productionDependencies) {
  if (!existsSync(join(modulesRoot, name, "package.json")))
    throw new Error(`A dependência de produção ${name} foi removida do standalone.`);
}

delete manifest.devDependencies;
writeFileSync(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);
unlinkSync(lockPath);

console.log(
  `Runtime preparado: ${productionDependencies.length} dependências diretas conferidas; ${removedDevelopmentPackages.length} pacotes de desenvolvimento removidos sem expandir o trace.`,
);
