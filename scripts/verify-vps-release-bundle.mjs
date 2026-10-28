import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstat, readFile, readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Open } from "unzipper-esm";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const packageJson = JSON.parse(await readFile(join(repositoryRoot, "package.json"), "utf8"));
const version = packageJson.version;
const expectedExcludedPathPattern =
  "(^|/)(\\.git|node_modules|\\.next|tmp|data|backups|output|coverage|test-results|public/uploads|\\.planning|\\.codex|\\.agents|\\.sites-runtime|\\.vercel|\\.ssh|secrets|credentials)(/|$)|(^|/)\\.env[^/]*$|(^|/)[^/]+\\.env$|(^|/)\\.npmrc$|(^|/)(authorized_keys|known_hosts)$|(^|/)(id_rsa|id_ed25519|id_ecdsa|id_dsa)(\\.pub)?$|(^|/)[^/]*\\.(sqlite|pem|key|p12|pfx|ppk|crt|p7b|secret)([-.].*)?$";
const maximumImageBytes = 550_000_000;
const maximumSourceEntryBytes = 50_000_000;
const maximumSourceBytes = 250_000_000;
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
  throw new Error("A candidata precisa manter externalBackupValidated:false até a validação do backup externo.");
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

const sourceManifestBytes = await readFile(join(bundleDirectory, manifest.sourceSnapshotManifest));
const sourceManifest = JSON.parse(sourceManifestBytes.toString("utf8"));
if (
  sourceManifest.format !== "hub-source-snapshot-v1" ||
  sourceManifest.packageVersion !== version ||
  sourceManifest.excludedPathPattern !== expectedExcludedPathPattern ||
  typeof sourceManifest.gitWorkingTreeClean !== "boolean" ||
  !Array.isArray(sourceManifest.files) ||
  sourceManifest.sourceFileCount !== sourceManifest.files.length ||
  sourceManifest.sourceFileCount !== manifest.sourceFileCount ||
  sourceManifest.gitStatusLineCount !== manifest.sourceGitStatusLineCount ||
  sourceManifest.gitWorkingTreeClean !== manifest.sourceGitWorkingTreeClean
)
  throw new Error("Manifesto de fontes inconsistente com o pacote ou com a versão.");

if (!Array.isArray(manifest.sourceFiles) || manifest.sourceFiles.length !== sourceManifest.files.length)
  throw new Error("O manifesto do pacote precisa registrar hash, tamanho e estado Git de cada fonte.");
for (let index = 0; index < sourceManifest.files.length; index += 1) {
  const source = sourceManifest.files[index];
  const bundled = manifest.sourceFiles[index];
  if (
    !bundled ||
    bundled.path !== source.path ||
    bundled.sha256 !== source.sha256 ||
    bundled.bytes !== source.bytes ||
    bundled.gitStatus !== source.gitStatus ||
    bundled.gitStatusLabel !== source.gitStatusLabel ||
    bundled.gitTracked !== source.gitTracked
  )
    throw new Error(`O estado Git ou o conteúdo da fonte diverge no manifesto do pacote: ${source.path}.`);
}

const expectedAdoptedTools = [
  "infra/package-source-snapshot.ps1",
  "infra/package-vps-release-bundle.ps1",
  "scripts/verify-vps-release-bundle.mjs",
  "scripts/verify-vps-runtime-image.mjs",
].sort();
if (
  !Array.isArray(manifest.adoptedReleaseTools) ||
  JSON.stringify([...manifest.adoptedReleaseTools].sort()) !== JSON.stringify(expectedAdoptedTools)
)
  throw new Error("O manifesto precisa identificar os quatro utilitários de release autorizados.");
for (const toolPath of expectedAdoptedTools) {
  if (!sourceFilesContain(manifest.sourceFiles, toolPath))
    throw new Error(`O utilitário adotado não aparece na proveniência do snapshot: ${toolPath}.`);
}

const sourceFiles = new Map();
let declaredSourceBytes = 0;
for (const file of sourceManifest.files) {
  if (
    !file ||
    typeof file.path !== "string" ||
    file.path.startsWith("/") ||
    file.path.includes("\\") ||
    file.path.includes("\0") ||
    /^[a-z]:/i.test(file.path) ||
    file.path.split("/").some((part) => part === "" || part === "." || part === "..") ||
    new RegExp(expectedExcludedPathPattern).test(file.path) ||
    !/^[a-f0-9]{64}$/.test(file.sha256) ||
    !Number.isSafeInteger(file.bytes) ||
    file.bytes < 0 ||
    file.bytes > maximumSourceEntryBytes ||
    typeof file.gitStatus !== "string" ||
    !/^(  |[ MADRCU?!]{2})$/.test(file.gitStatus) ||
    !["tracked", "modified", "added", "renamed", "conflicted", "untracked"].includes(file.gitStatusLabel) ||
    typeof file.gitTracked !== "boolean" ||
    (file.gitStatusLabel === "untracked" && (file.gitStatus !== "??" || file.gitTracked)) ||
    (file.gitStatusLabel === "tracked" && (!file.gitTracked || file.gitStatus !== "  ")) ||
    sourceFiles.has(file.path)
  )
    throw new Error(
      `Entrada inválida ou duplicada no manifesto de fontes: ${file?.path ?? "desconhecida"}.`,
    );
  declaredSourceBytes += file.bytes;
  if (declaredSourceBytes > maximumSourceBytes)
    throw new Error("O ZIP declara mais fontes do que o limite de auditoria permite.");
  sourceFiles.set(file.path, file);
}

const archive = await Open.file(join(bundleDirectory, manifest.sourceArchive));
const archiveEntries = new Map();
for (const entry of archive.files) {
  const path = entry.path.replaceAll("\\", "/");
  if (
    entry.type !== "File" ||
    !path ||
    path.startsWith("/") ||
    path.includes("\0") ||
    /^[a-z]:/i.test(path) ||
    path.split("/").some((part) => part === "" || part === "." || part === "..") ||
    new RegExp(expectedExcludedPathPattern).test(path) ||
    archiveEntries.has(path)
  )
    throw new Error(`Caminho inválido ou duplicado no ZIP de fontes: ${path || "vazio"}.`);
  archiveEntries.set(path, entry);
}
if (archiveEntries.size !== sourceFiles.size + 1)
  throw new Error("Quantidade de entradas do ZIP não corresponde ao manifesto de fontes.");

const embeddedManifestEntry = archiveEntries.get("SOURCE-MANIFEST.json");
if (!embeddedManifestEntry) throw new Error("SOURCE-MANIFEST.json ausente do ZIP de fontes.");
const embeddedManifestBytes = await embeddedManifestEntry.buffer();
if (sha256(embeddedManifestBytes) !== manifest.sourceSnapshotManifestSha256)
  throw new Error("O manifesto interno do ZIP difere do manifesto separado do pacote.");
if (!embeddedManifestBytes.equals(sourceManifestBytes))
  throw new Error("O manifesto interno e o manifesto separado não são idênticos.");
archiveEntries.delete("SOURCE-MANIFEST.json");

for (const [path, expected] of sourceFiles) {
  const entry = archiveEntries.get(path);
  if (!entry || entry.uncompressedSize !== expected.bytes)
    throw new Error(`Arquivo ausente ou com tamanho divergente no ZIP: ${path}.`);
  const result = await hashStream(entry.stream());
  if (result.bytes !== expected.bytes || result.sha256 !== expected.sha256)
    throw new Error(`Arquivo com SHA-256 ou tamanho divergente no ZIP: ${path}.`);
  archiveEntries.delete(path);
}
if (archiveEntries.size !== 0) throw new Error("O ZIP contém fontes não listadas no manifesto.");

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
  `Pacote íntegro: versão ${version}; ${sourceFiles.size} arquivos de fonte conferidos; imagem ${manifest.imageTag} (${manifest.imageBytes} bytes); SHA-256 e conteúdos verificados.`,
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
