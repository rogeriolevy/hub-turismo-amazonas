import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstat, readFile, readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyVpsSourceSnapshot } from "./verify-vps-source-snapshot.mjs";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const packageJson = JSON.parse(await readFile(join(repositoryRoot, "package.json"), "utf8"));
const version = packageJson.version;
const maximumImageBytes = 550_000_000;
const bundlePath = process.argv[2];

if (!bundlePath) throw new Error("Uso: npm run verify:vps-release-bundle -- <pasta-do-pacote>");
if (!/^\d+\.\d+\.\d+$/.test(version))
  throw new Error(`Versão inválida no package.json: ${version}`);

const bundleDirectory = resolve(process.cwd(), bundlePath);
const directoryStat = await lstat(bundleDirectory);
if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink())
  throw new Error(`O pacote precisa ser uma pasta local normal: ${bundleDirectory}`);

const manifestPath = join(bundleDirectory, "manifest.json");
const manifestBytes = await readFile(manifestPath);
const manifest = JSON.parse(manifestBytes.toString("utf8"));
const manifestHash = sha256(manifestBytes);
const manifestSidecar = await readFile(`${manifestPath}.sha256`, "utf8");
assertSidecar(manifestSidecar, manifestHash, "manifest.json");

const expectedImageArchive = `hub-turismo-amazonas-${version}-image.tar`;
const expectedSourceArchive = `hub-turismo-amazonas-${version}-source.zip`;
const expectedNotes = `${version}-release-notes.md`;
if (manifest.format !== "hub-vps-release-bundle-v1")
  throw new Error("Formato de pacote VPS desconhecido.");
if (manifest.status !== "local-candidate-not-deployed" || manifest.appVersion !== version)
  throw new Error(`O manifesto não identifica a candidata local ${version}.`);
if (
  manifest.imageTag !== `hub-turismo-amazonas:${version}` ||
  manifest.composeExpectedTag !== manifest.imageTag
)
  throw new Error("Etiqueta da imagem ou do Compose divergente da versão do projeto.");
if (manifest.databaseMigration !== false)
  throw new Error("O pacote declara migração de banco; revisão de compatibilidade necessária.");
if (manifest.externalBackupValidated !== false)
  throw new Error(
    "A candidata precisa manter externalBackupValidated:false até a validação do backup externo.",
  );
if (
  manifest.imageArchive !== expectedImageArchive ||
  manifest.imageArchiveSha256Sidecar !== `${expectedImageArchive}.sha256` ||
  manifest.sourceArchive !== expectedSourceArchive ||
  manifest.sourceArchiveSha256Sidecar !== `${expectedSourceArchive}.sha256` ||
  manifest.sourceSnapshotManifest !== "SOURCE-MANIFEST.json" ||
  manifest.releaseNotes !== expectedNotes ||
  manifest.readme !== "README.md"
)
  throw new Error("Nomes de arquivos do pacote não correspondem à versão.");

const expectedFiles = [
  "manifest.json",
  "manifest.json.sha256",
  manifest.imageArchive,
  manifest.imageArchiveSha256Sidecar,
  manifest.sourceArchive,
  manifest.sourceArchiveSha256Sidecar,
  manifest.sourceSnapshotManifest,
  manifest.releaseNotes,
  manifest.readme,
].sort();
const actualEntries = (await readdir(bundleDirectory, { withFileTypes: true }))
  .map((entry) => {
    if (!entry.isFile() || entry.isSymbolicLink())
      throw new Error(`Tipo de arquivo inesperado no pacote: ${entry.name}`);
    return entry.name;
  })
  .sort();
if (JSON.stringify(actualEntries) !== JSON.stringify(expectedFiles))
  throw new Error(
    `Arquivos do pacote divergentes. Esperados: ${expectedFiles.join(", ")}; encontrados: ${actualEntries.join(", ")}.`,
  );

for (const [name, expectedBytes, expectedHash] of [
  [manifest.imageArchive, manifest.imageArchiveBytes, manifest.imageArchiveSha256],
  [manifest.sourceArchive, manifest.sourceArchiveBytes, manifest.sourceArchiveSha256],
]) {
  const result = await hashFile(join(bundleDirectory, name));
  if (result.bytes !== expectedBytes || result.sha256 !== expectedHash)
    throw new Error(`Tamanho ou SHA-256 divergente: ${name}.`);
  const sidecar = await readFile(join(bundleDirectory, `${name}.sha256`), "utf8");
  assertSidecar(sidecar, expectedHash, name);
}

for (const [name, expectedHash] of [
  [manifest.releaseNotes, manifest.releaseNotesSha256],
  [manifest.readme, manifest.readmeSha256],
  [manifest.sourceSnapshotManifest, manifest.sourceSnapshotManifestSha256],
]) {
  const bytes = await readFile(join(bundleDirectory, name));
  if (sha256(bytes) !== expectedHash) throw new Error(`SHA-256 divergente: ${name}.`);
}

const sourceVerification = await verifyVpsSourceSnapshot(
  join(bundleDirectory, manifest.sourceArchive),
  join(bundleDirectory, manifest.sourceSnapshotManifest),
  {
    gitHead: manifest.sourceGitBaseCommit,
    gitTree: manifest.sourceGitTree,
    gitObjectFormat: manifest.sourceGitObjectFormat,
    packageVersion: version,
  },
);
const sourceManifest = sourceVerification.manifest;
if (
  sourceManifest.packageVersion !== version ||
  sourceManifest.sourceFileCount !== manifest.sourceFileCount ||
  sourceManifest.sourceGitStatusLineCount !== manifest.sourceGitStatusLineCount ||
  sourceManifest.sourceGitWorkingTreeClean !== manifest.sourceGitWorkingTreeClean ||
  sourceManifest.sourceArchiveMethod !== manifest.sourceArchiveMethod
)
  throw new Error("Manifesto de fontes inconsistente com o pacote ou com a versão.");

if (
  !Array.isArray(manifest.sourceFiles) ||
  manifest.sourceFiles.length !== sourceManifest.files.length
)
  throw new Error(
    "O manifesto do pacote precisa registrar hash, tamanho e estado Git de cada fonte.",
  );
for (let index = 0; index < sourceManifest.files.length; index += 1) {
  const source = sourceManifest.files[index];
  const bundled = manifest.sourceFiles[index];
  if (
    !bundled ||
    bundled.path !== source.path ||
    bundled.sha256 !== source.sha256 ||
    bundled.bytes !== source.bytes ||
    bundled.gitBlob !== source.gitBlob ||
    bundled.gitMode !== source.gitMode ||
    bundled.gitStatus !== source.gitStatus ||
    bundled.gitStatusLabel !== source.gitStatusLabel ||
    bundled.gitTracked !== source.gitTracked
  )
    throw new Error(
      `O estado Git ou o conteúdo da fonte diverge no manifesto do pacote: ${source.path}.`,
    );
}

const expectedAdoptedTools = [
  "infra/package-source-snapshot.ps1",
  "infra/package-vps-release-bundle.ps1",
  "scripts/verify-vps-source-snapshot.mjs",
  "scripts/verify-vps-release-bundle.mjs",
  "scripts/verify-vps-runtime-image.mjs",
].sort();
if (
  !Array.isArray(manifest.adoptedReleaseTools) ||
  JSON.stringify([...manifest.adoptedReleaseTools].sort()) !== JSON.stringify(expectedAdoptedTools)
)
  throw new Error("O manifesto precisa identificar os cinco utilitários de release autorizados.");
for (const toolPath of expectedAdoptedTools) {
  if (!sourceFilesContain(manifest.sourceFiles, toolPath))
    throw new Error(`O utilitário adotado não aparece na proveniência do snapshot: ${toolPath}.`);
}

if (
  !/^sha256:[a-f0-9]{64}$/.test(manifest.imageId) ||
  manifest.imageArchiveLoadVerified !== true ||
  manifest.imageArchiveLoadImageId !== manifest.imageId ||
  manifest.runtimeUser !== "node" ||
  manifest.runtimeDevDependenciesPresent !== false ||
  manifest.runtimeHealthcheckScriptPresent !== true ||
  manifest.runtimeForbiddenPackageScan !== "passed" ||
  manifest.runtimeImageVerifier !== "passed" ||
  manifest.runtimeHealthcheckScriptPresent !== true ||
  !Number.isSafeInteger(manifest.imageBytes) ||
  manifest.imageBytes > maximumImageBytes ||
  manifest.runtimeImageSizeLimitBytes !== maximumImageBytes
)
  throw new Error("Metadados de runtime da imagem não satisfazem os critérios aprovados.");

const dockerMetadata = runDocker([
  "image",
  "inspect",
  "--format",
  "{{.Id}}|{{.Size}}|{{.Config.User}}",
  manifest.imageTag,
]);
const [imageId, imageSizeText, runtimeUser] = dockerMetadata.split("|");
if (
  imageId !== manifest.imageId ||
  Number(imageSizeText) !== manifest.imageBytes ||
  runtimeUser !== manifest.runtimeUser
)
  throw new Error("A imagem Docker local difere da identidade ou tamanho registrados no pacote.");

const runtimeCheck = runProcess(process.execPath, [
  "scripts/verify-vps-runtime-image.mjs",
  "--manifest",
  manifestPath,
]);
console.log(runtimeCheck);
console.log(
  `Pacote íntegro: versão ${version}; ${sourceManifest.files.length} arquivos de fonte conferidos; imagem ${manifest.imageTag} (${manifest.imageBytes} bytes); SHA-256 e conteúdos verificados.`,
);
if (manifest.externalBackupValidated !== true)
  console.log(
    "PUBLICAÇÃO PENDENTE: a cópia externa do backup ainda precisa ser recebida e validada por restauração independente.",
  );
else console.log("O manifesto registra a validação da cópia externa do backup.");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sourceFilesContain(files, filePath) {
  return files.some((file) => file?.path === filePath);
}

async function hashFile(path) {
  return hashStream(createReadStream(path));
}

async function hashStream(stream) {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of stream) {
    bytes += chunk.length;
    hash.update(chunk);
  }
  return { bytes, sha256: hash.digest("hex") };
}

function assertSidecar(contents, expectedHash, fileName) {
  const line = contents.trimEnd();
  if (line !== `${expectedHash}  ${fileName}`)
    throw new Error(`Sidecar SHA-256 inválido para ${fileName}.`);
}

function runDocker(args) {
  return runProcess("docker", args);
}

function runProcess(command, args) {
  try {
    return execFileSync(command, args, {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const details = [error.stdout, error.stderr]
      .map((value) => (Buffer.isBuffer(value) ? value.toString("utf8") : value))
      .filter(Boolean)
      .join("\n")
      .trim();
    throw new Error(
      `${basename(command)} não conseguiu concluir a auditoria.${details ? `\n${details}` : ""}`,
      { cause: error },
    );
  }
}
