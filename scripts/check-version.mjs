import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const packageJson = await readFile(new URL("package.json", root), "utf8").then(JSON.parse);
const [packageLock, platformGuide, releaseLog] = await Promise.all([
  readFile(new URL("package-lock.json", root), "utf8").then(JSON.parse),
  readFile(new URL("docs/PLATAFORMA.md", root), "utf8"),
  readFile(new URL(`docs/releases/${packageJson.version}.md`, root), "utf8").catch(() => null),
]);

const documentedVersion = /^Versão ([0-9]+\.[0-9]+\.[0-9]+),/m.exec(platformGuide)?.[1];
const releaseVersion = releaseLog
  ? /^# (?:Candidata|Release) ([0-9]+\.[0-9]+\.[0-9]+)\b/m.exec(releaseLog)?.[1]
  : undefined;
const versions = {
  "package.json": packageJson.version,
  "package-lock.json": packageLock.version,
  "package-lock.json packages['']": packageLock.packages?.[""]?.version,
  "docs/PLATAFORMA.md": documentedVersion,
  [`docs/releases/${packageJson.version}.md`]: releaseVersion,
};
const distinctVersions = new Set(Object.values(versions));

if (!documentedVersion || !releaseVersion || distinctVersions.size !== 1) {
  console.error(
    "As versões do pacote, lockfile, documentação da plataforma e título do release log precisam coincidir:",
  );
  for (const [source, version] of Object.entries(versions))
    console.error(`- ${source}: ${version ?? "ausente"}`);
  process.exitCode = 1;
} else {
  console.log(`Versão coerente: ${packageJson.version}`);
}
