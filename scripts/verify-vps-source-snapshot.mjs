import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { Open } from "unzipper-esm";

export const expectedExcludedPathPattern =
  "(^|/)(\\.git|node_modules|\\.next|tmp|data|backups|output|coverage|test-results|public/uploads|\\.planning|\\.codex|\\.agents|\\.sites-runtime|\\.vercel|\\.ssh|secrets|credentials)(/|$)|(^|/)\\.env[^/]*$|(^|/)[^/]+\\.env$|(^|/)\\.npmrc$|(^|/)(authorized_keys|known_hosts)$|(^|/)(id_rsa|id_ed25519|id_ecdsa|id_dsa)(\\.pub)?$|(^|/)[^/]*\\.(sqlite|pem|key|p12|pfx|ppk|crt|p7b|secret)([-.].*)?$";
const maximumSourceEntryBytes = 50_000_000;
const maximumSourceBytes = 250_000_000;

export async function verifyVpsSourceSnapshot(archivePathInput, manifestPathInput, expected = {}) {
  const archivePath = resolve(archivePathInput);
  const manifestPath = resolve(manifestPathInput);
  const [archiveStat, manifestStat] = await Promise.all([lstat(archivePath), lstat(manifestPath)]);
  if (!archiveStat.isFile() || archiveStat.isSymbolicLink())
    throw new Error(`O ZIP de fontes precisa ser um arquivo regular: ${archivePath}`);
  if (!manifestStat.isFile() || manifestStat.isSymbolicLink())
    throw new Error(`O manifesto de fontes precisa ser um arquivo regular: ${manifestPath}`);
  if (manifestStat.size > 10_000_000)
    throw new Error("O manifesto de fontes excede o limite de tamanho permitido.");
  if (archiveStat.size > maximumSourceBytes + 10_000_000)
    throw new Error("O ZIP de fontes excede o limite de tamanho permitido.");
  const sidecarPath = `${archivePath}.sha256`;
  const sidecarStat = await lstat(sidecarPath);
  if (!sidecarStat.isFile() || sidecarStat.isSymbolicLink())
    throw new Error(`O sidecar SHA-256 precisa ser um arquivo regular: ${sidecarPath}`);

  const manifestBytes = await readFile(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const objectFormat = manifest.gitObjectFormat;
  const objectIdLength = objectFormat === "sha1" ? 40 : objectFormat === "sha256" ? 64 : 0;
  const objectIdPattern = objectIdLength ? new RegExp(`^[a-f0-9]{${objectIdLength}}$`) : null;
  if (
    manifest.format !== "hub-source-snapshot-v4" ||
    !/^\d+\.\d+\.\d+$/.test(manifest.packageVersion) ||
    !objectIdPattern ||
    !objectIdPattern.test(manifest.gitHead) ||
    !objectIdPattern.test(manifest.gitTree) ||
    manifest.sourceArchiveMethod !== "git-archive" ||
    manifest.sourceGitStatusLineCount !== 0 ||
    manifest.sourceGitWorkingTreeClean !== true ||
    !Number.isSafeInteger(manifest.repositoryGitStatusLineCount) ||
    manifest.repositoryGitStatusLineCount < 0 ||
    manifest.excludedPathPattern !== expectedExcludedPathPattern ||
    !Array.isArray(manifest.files) ||
    manifest.sourceFileCount !== manifest.files.length ||
    !Array.isArray(manifest.gitTreeEntries) ||
    manifest.gitTreeEntries.length === 0 ||
    manifest.gitTreeEntries.length > 50_000
  )
    throw new Error("O manifesto de fontes não comprova um snapshot Git limpo e aprovado.");

  if (
    (expected.gitHead && manifest.gitHead !== expected.gitHead) ||
    (expected.gitTree && manifest.gitTree !== expected.gitTree) ||
    (expected.gitObjectFormat && manifest.gitObjectFormat !== expected.gitObjectFormat) ||
    (expected.packageVersion && manifest.packageVersion !== expected.packageVersion)
  )
    throw new Error(
      "O commit, a árvore ou o formato Git do manifesto diverge da aprovação esperada.",
    );

  const archiveDigest = await hashFile(archivePath);
  const sidecar = await readFile(`${archivePath}.sha256`, "utf8");
  assertSidecar(sidecar, archiveDigest.sha256, basename(archivePath));

  const sourceFiles = new Map();
  let declaredSourceBytes = 0;
  for (const file of manifest.files) {
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
      !objectIdPattern.test(file.gitBlob) ||
      !["100644", "100755"].includes(file.gitMode) ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 0 ||
      file.bytes > maximumSourceEntryBytes ||
      file.gitTracked !== true ||
      file.gitStatus !== "  " ||
      file.gitStatusLabel !== "tracked" ||
      sourceFiles.has(file.path)
    )
      throw new Error(
        `Entrada inválida ou duplicada no manifesto de fontes: ${file?.path ?? "desconhecida"}.`,
      );
    declaredSourceBytes += file.bytes;
    if (declaredSourceBytes > maximumSourceBytes)
      throw new Error("O manifesto declara mais fontes do que o limite de auditoria permite.");
    sourceFiles.set(file.path, file);
  }

  verifyGitTreeProof({
    entries: manifest.gitTreeEntries,
    rootTree: manifest.gitTree,
    objectFormat,
    objectIdPattern,
    excludedPathPattern: expectedExcludedPathPattern,
    sourceFiles,
  });

  if (expected.selfCheck === true) {
    const verifierRecord = sourceFiles.get("scripts/verify-vps-source-snapshot.mjs");
    if (!verifierRecord) throw new Error("O manifesto não registra o verificador executado.");
    const verifierBytes = await readFile(fileURLToPath(import.meta.url));
    const verifierGitBlob = createHash(objectFormat)
      .update(Buffer.from(`blob ${verifierBytes.length}\0`, "utf8"))
      .update(verifierBytes)
      .digest("hex");
    if (
      sha256(verifierBytes) !== verifierRecord.sha256 ||
      verifierGitBlob !== verifierRecord.gitBlob
    )
      throw new Error("O verificador executado não corresponde ao arquivo aprovado no commit.");
  }

  const archive = await Open.file(archivePath);
  const archiveEntries = new Map();
  for (const entry of archive.files) {
    if (entry.path.includes("\\"))
      throw new Error(`O ZIP de fontes usa separadores Windows: ${entry.path}.`);
    const path = entry.path;
    const directoryEntry = path.endsWith("/") || entry.type === "Directory";
    const normalizedPath = directoryEntry ? path.replace(/\/+$/, "") : path;
    if (
      !normalizedPath ||
      normalizedPath.startsWith("/") ||
      normalizedPath.includes("\0") ||
      /^[a-z]:/i.test(normalizedPath) ||
      normalizedPath.split("/").some((part) => part === "" || part === "." || part === "..") ||
      new RegExp(expectedExcludedPathPattern).test(normalizedPath) ||
      (directoryEntry ? entry.type !== "Directory" : entry.type !== "File")
    )
      throw new Error(`Caminho ou tipo inválido no ZIP de fontes: ${path || "vazio"}.`);
    if (directoryEntry) continue;
    if (archiveEntries.has(normalizedPath))
      throw new Error(`Entrada duplicada no ZIP de fontes: ${normalizedPath}.`);
    archiveEntries.set(normalizedPath, entry);
  }
  if (archiveEntries.size !== sourceFiles.size + 1)
    throw new Error("Quantidade de entradas do ZIP não corresponde ao manifesto de fontes.");

  const embeddedManifestEntry = archiveEntries.get("SOURCE-MANIFEST.json");
  if (!embeddedManifestEntry) throw new Error("SOURCE-MANIFEST.json ausente do ZIP de fontes.");
  const embeddedManifestBytes = await embeddedManifestEntry.buffer();
  if (!embeddedManifestBytes.equals(manifestBytes))
    throw new Error("O manifesto interno e o manifesto separado não são idênticos.");
  archiveEntries.delete("SOURCE-MANIFEST.json");

  const packageEntry = archiveEntries.get("package.json");
  if (!packageEntry) throw new Error("package.json ausente do ZIP de fontes.");
  const packageBytes = await packageEntry.buffer();
  const packageJson = JSON.parse(packageBytes.toString("utf8"));
  if (packageJson.version !== manifest.packageVersion)
    throw new Error("A versão de package.json diverge do manifesto do snapshot.");

  for (const [path, expectedFile] of sourceFiles) {
    const entry = archiveEntries.get(path);
    if (!entry || entry.uncompressedSize !== expectedFile.bytes)
      throw new Error(`Arquivo ausente ou com tamanho divergente no ZIP: ${path}.`);
    const stream = path === "package.json" ? Readable.from(packageBytes) : entry.stream();
    const result = await hashStream(stream, objectFormat, expectedFile.bytes);
    if (
      result.bytes !== expectedFile.bytes ||
      result.sha256 !== expectedFile.sha256 ||
      result.gitBlob !== expectedFile.gitBlob
    )
      throw new Error(`SHA-256 ou blob Git diverge do commit aprovado: ${path}.`);
    archiveEntries.delete(path);
  }
  if (archiveEntries.size !== 0) throw new Error("O ZIP contém fontes não listadas no manifesto.");

  return {
    manifest,
    archiveBytes: archiveDigest.bytes,
    archiveSha256: archiveDigest.sha256,
    verifiedFiles: sourceFiles.size,
    verifiedEntries: sourceFiles.size + 1,
  };
}

async function hashFile(path) {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(path)) {
    bytes += chunk.length;
    hash.update(chunk);
  }
  return { bytes, sha256: hash.digest("hex") };
}

function verifyGitTreeProof({
  entries,
  rootTree,
  objectFormat,
  objectIdPattern,
  excludedPathPattern,
  sourceFiles,
}) {
  const seenPaths = new Set();
  const directories = new Map([["", { objectId: rootTree }]]);
  const childrenByDirectory = new Map([["", []]]);
  const includedFiles = new Map();
  const excludedPath = new RegExp(excludedPathPattern);

  for (const entry of entries) {
    if (
      !entry ||
      typeof entry.path !== "string" ||
      entry.path.startsWith("/") ||
      entry.path.includes("\\") ||
      entry.path.includes("\0") ||
      entry.path.includes('"') ||
      /[\x00-\x1f\x7f]/.test(entry.path) ||
      /^[a-z]:/i.test(entry.path) ||
      entry.path.split("/").some((part) => part === "" || part === "." || part === "..") ||
      !objectIdPattern.test(entry.objectId) ||
      seenPaths.has(entry.path)
    )
      throw new Error(
        `Entrada inválida ou duplicada na prova da árvore Git: ${entry?.path ?? "desconhecida"}.`,
      );

    let mode = entry.mode;
    const isTree = entry.objectType === "tree" && ["040000", "40000"].includes(mode);
    const isBlob = entry.objectType === "blob" && ["100644", "100755", "120000"].includes(mode);
    const isCommit = entry.objectType === "commit" && mode === "160000";
    if (!isTree && !isBlob && !isCommit)
      throw new Error(`Modo ou tipo inválido na prova da árvore Git: ${entry.path}.`);
    if (isTree) mode = "40000";

    const parts = entry.path.split("/");
    const name = parts.at(-1);
    const parent = parts.slice(0, -1).join("/");
    const children = childrenByDirectory.get(parent) ?? [];
    children.push({ name, mode, objectType: entry.objectType, objectId: entry.objectId });
    childrenByDirectory.set(parent, children);
    seenPaths.add(entry.path);

    if (isTree) {
      if (directories.has(entry.path))
        throw new Error(`Diretório duplicado na prova da árvore Git: ${entry.path}.`);
      directories.set(entry.path, { objectId: entry.objectId });
      childrenByDirectory.set(entry.path, childrenByDirectory.get(entry.path) ?? []);
      continue;
    }

    if (entry.path === "SOURCE-MANIFEST.json")
      throw new Error(
        "A raiz do commit reserva SOURCE-MANIFEST.json para o manifesto do snapshot.",
      );
    if (excludedPath.test(entry.path)) continue;
    if (!isBlob || !["100644", "100755"].includes(mode))
      throw new Error(`A fonte selecionada não é um arquivo regular: ${entry.path}.`);
    includedFiles.set(entry.path, { gitBlob: entry.objectId, gitMode: mode });
  }

  for (const path of seenPaths) {
    const parent = path.split("/").slice(0, -1).join("/");
    if (!directories.has(parent))
      throw new Error(`Diretório pai ausente na prova da árvore Git: ${path}.`);
  }

  const directoryPaths = [...directories.keys()].filter(Boolean).sort((left, right) => {
    const depth = right.split("/").length - left.split("/").length;
    return depth || right.localeCompare(left);
  });
  for (const path of directoryPaths) {
    const node = directories.get(path);
    const computed = hashGitTree(childrenByDirectory.get(path) ?? [], objectFormat);
    if (computed !== node.objectId)
      throw new Error(`Hash da subárvore Git diverge do commit aprovado: ${path}.`);
  }

  if (hashGitTree(childrenByDirectory.get("") ?? [], objectFormat) !== rootTree)
    throw new Error("As entradas da árvore Git não produzem a árvore aprovada.");
  if (includedFiles.size !== sourceFiles.size)
    throw new Error(
      "A lista de fontes não corresponde aos arquivos selecionáveis na árvore Git aprovada.",
    );
  for (const [path, expected] of includedFiles) {
    const actual = sourceFiles.get(path);
    if (!actual || actual.gitBlob !== expected.gitBlob || actual.gitMode !== expected.gitMode)
      throw new Error(`O blob declarado para ${path} não pertence à árvore Git aprovada.`);
  }
}

function hashGitTree(entries, objectFormat) {
  const orderedEntries = [...entries].sort(compareGitTreeEntries);
  const chunks = [];
  for (const entry of orderedEntries) {
    chunks.push(Buffer.from(`${entry.mode} ${entry.name}\0`, "utf8"));
    chunks.push(Buffer.from(entry.objectId, "hex"));
  }
  const content = Buffer.concat(chunks);
  return createHash(objectFormat)
    .update(Buffer.from(`tree ${content.length}\0`, "utf8"))
    .update(content)
    .digest("hex");
}

function compareGitTreeEntries(left, right) {
  const leftName = Buffer.from(left.name, "utf8");
  const rightName = Buffer.from(right.name, "utf8");
  const maxLength = Math.max(leftName.length, rightName.length);
  for (let index = 0; index <= maxLength; index += 1) {
    const leftByte = index < leftName.length ? leftName[index] : left.mode === "40000" ? 0x2f : 0;
    const rightByte =
      index < rightName.length ? rightName[index] : right.mode === "40000" ? 0x2f : 0;
    if (leftByte !== rightByte) return leftByte - rightByte;
    if (index >= leftName.length && index >= rightName.length) return 0;
  }
  return 0;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function hashStream(stream, objectFormat, expectedBytes) {
  const hash = createHash("sha256");
  const gitBlobHash = createHash(objectFormat);
  gitBlobHash.update(Buffer.from(`blob ${expectedBytes}\0`, "utf8"));
  let bytes = 0;
  for await (const chunk of stream) {
    bytes += chunk.length;
    if (bytes > expectedBytes) throw new Error("Entrada ZIP maior do que o tamanho aprovado.");
    hash.update(chunk);
    gitBlobHash.update(chunk);
  }
  return { bytes, sha256: hash.digest("hex"), gitBlob: gitBlobHash.digest("hex") };
}

function assertSidecar(contents, expectedHash, fileName) {
  if (contents.trimEnd() !== `${expectedHash}  ${fileName}`)
    throw new Error(`Sidecar SHA-256 inválido para ${fileName}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , archivePath, manifestPath, gitHead, gitTree, ...flags] = process.argv;
  if (!archivePath || !manifestPath)
    throw new Error(
      "Uso: node scripts/verify-vps-source-snapshot.mjs <arquivo.zip> <SOURCE-MANIFEST.json> [commit-aprovado] [árvore-aprovada] [--self-check]",
    );
  if (!flags.includes("--self-check"))
    throw new Error(
      "SELF_CHECK_REQUIRED: a execução direta exige --self-check antes de ler o snapshot.",
    );
  const result = await verifyVpsSourceSnapshot(archivePath, manifestPath, {
    gitHead,
    gitTree,
    selfCheck: true,
  });
  console.log(
    `Source snapshot íntegro: commit ${result.manifest.gitHead}; árvore ${result.manifest.gitTree}; ${result.verifiedFiles} arquivos e ${result.verifiedEntries} entradas conferidos por SHA-256 e blob Git.`,
  );
}
