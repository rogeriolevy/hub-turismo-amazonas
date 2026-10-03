import { randomBytes, createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import {
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";

const workspace = process.cwd();
const workspaceNext = resolve(workspace, ".next");
const stageRoot = join(tmpdir(), "hub-turismo-amazonas-build-cache");
const stageProject = join(stageRoot, "project");
const excludedRoots = new Set([
  ".codex",
  ".git",
  ".next",
  "backups",
  "data",
  "node_modules",
  "tmp",
]);

function run(command, args, cwd, env = process.env) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ["inherit", "pipe", "pipe"],
      windowsHide: true,
    });
    let output = "";
    const forward = (stream) => (chunk) => {
      const value = chunk.toString();
      stream.write(value);
      output = (output + value).slice(-50000);
    };
    child.stdout.on("data", forward(process.stdout));
    child.stderr.on("data", forward(process.stderr));
    child.on("error", (error) => {
      process.stderr.write(`${error.message}\n`);
      resolveRun({ code: 1, output: `${output}\n${error.message}` });
    });
    child.on("close", (code) => resolveRun({ code: code ?? 1, output }));
  });
}

function getFilesystem(path) {
  if (process.platform !== "win32") return null;
  const drive = parse(resolve(path)).root?.slice(0, 2);
  if (!drive) return null;
  const result = spawnSync("fsutil.exe", ["fsinfo", "volumeinfo", drive], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 5000,
  });
  if (result.status !== 0) return null;
  const match = `${result.stdout}\n${result.stderr}`.match(/\b(NTFS|FAT32|exFAT|ReFS)\b/i);
  return match?.[1].toUpperCase() ?? null;
}

function isFilesystemError(output) {
  return /EISDIR: illegal operation on a directory, readlink|failed to create (?:a )?(?:junction|symbolic link)|creation of a new symbolic link or junction point failed/i.test(
    output,
  );
}

function ensureInside(parent, child) {
  const rel = relative(resolve(parent), resolve(child));
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`Caminho inesperado fora da pasta de build: ${child}`);
  }
}

async function clearStageSources() {
  await mkdir(stageProject, { recursive: true });
  ensureInside(stageRoot, stageProject);
  const stageRealPath = await realpath(stageProject);
  if (resolve(stageRealPath) !== resolve(stageProject)) {
    throw new Error("A pasta de preparação aponta para fora do diretório temporário esperado.");
  }

  const modulesPath = join(stageProject, "node_modules");
  const moduleInfo = await lstat(modulesPath).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (moduleInfo?.isSymbolicLink()) {
    throw new Error("A pasta temporária node_modules é um link; remova-a antes de reconstruir.");
  }
  if (moduleInfo && !moduleInfo.isDirectory()) {
    throw new Error("A pasta temporária node_modules não é um diretório.");
  }

  for (const name of await readdir(stageProject)) {
    if (name !== "node_modules")
      await rm(join(stageProject, name), { recursive: true, force: true });
  }

  await cp(workspace, stageProject, {
    recursive: true,
    force: true,
    filter(source) {
      const rel = relative(workspace, source);
      if (!rel) return true;
      const first = rel.split(sep)[0];
      return !excludedRoots.has(first) && rel !== ".env.local" && !rel.endsWith(".tsbuildinfo");
    },
  });
}

async function installStagedDependencies() {
  const markerPath = join(stageRoot, "dependency-lock.sha256");
  const lock = await readFile(resolve(workspace, "package-lock.json"));
  const manifest = await readFile(resolve(workspace, "package.json"));
  const npmrc = await readFile(resolve(workspace, ".npmrc")).catch(() => Buffer.alloc(0));
  const lockHash = createHash("sha256").update(lock).update(manifest).update(npmrc).digest("hex");
  const nextCli = join(stageProject, "node_modules", "next", "dist", "bin", "next");
  const installedHash = await readFile(markerPath, "utf8").catch(() => "");
  if (installedHash === lockHash && (await lstat(nextCli).catch(() => null))) return;

  const npmCli = process.env.npm_execpath;
  const result = npmCli
    ? await run(process.execPath, [npmCli, "ci"], stageProject)
    : await run("npm.cmd", ["ci"], stageProject);
  if (result.code !== 0) throw new Error("A instalação temporária de dependências falhou.");
  await writeFile(markerPath, lockHash, "utf8");
}

async function loadWorkspaceEnvironment(overrides) {
  const envFile = resolve(workspace, ".env.local");
  try {
    process.loadEnvFile(envFile);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return {
    ...process.env,
    ...overrides,
  };
}

async function copyBuiltOutput() {
  const stageNext = join(stageProject, ".next");
  const stageNextInfo = await lstat(stageNext);
  if (!stageNextInfo.isDirectory() || stageNextInfo.isSymbolicLink()) {
    throw new Error("O build temporário não produziu um diretório .next válido.");
  }

  const codexRoot = join(workspace, ".codex");
  await mkdir(codexRoot, { recursive: true });
  const copyPath = join(codexRoot, `next-copy-${process.pid}`);
  const previousPath = join(codexRoot, `next-previous-${process.pid}`);
  ensureInside(workspace, codexRoot);
  ensureInside(codexRoot, copyPath);
  ensureInside(codexRoot, previousPath);
  if (await lstat(copyPath).catch(() => null)) {
    throw new Error(`Já existe uma cópia temporária de build: ${copyPath}`);
  }
  if (await lstat(previousPath).catch(() => null)) {
    throw new Error(`Já existe um artefato anterior: ${previousPath}`);
  }

  await cp(stageNext, copyPath, { recursive: true });
  const current = await lstat(workspaceNext).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  let movedPrevious = false;
  if (current) {
    if (!current.isDirectory() || current.isSymbolicLink()) {
      await rm(copyPath, { recursive: true, force: true });
      throw new Error(
        "O artefato .next atual não é um diretório comum; preservei-o sem substituir.",
      );
    }
    const currentRealPath = await realpath(workspaceNext);
    if (resolve(currentRealPath) !== resolve(workspaceNext)) {
      await rm(copyPath, { recursive: true, force: true });
      throw new Error("O artefato .next atual resolve para fora do projeto; preservei-o.");
    }
    await rename(workspaceNext, previousPath);
    movedPrevious = true;
  }

  try {
    await rename(copyPath, workspaceNext);
  } catch (error) {
    if (movedPrevious) await rename(previousPath, workspaceNext);
    throw error;
  }
  if (movedPrevious) await rm(previousPath, { recursive: true, force: true });
  console.log("Build preparado em NTFS e copiado para .next no volume do projeto.");
}

async function buildOnNtfs() {
  const stageDriveFilesystem = getFilesystem(dirname(stageRoot));
  if (stageDriveFilesystem && stageDriveFilesystem !== "NTFS") {
    throw new Error(
      `O diretório temporário está em ${stageDriveFilesystem}; a preparação exige NTFS. Configure TEMP em uma unidade NTFS.`,
    );
  }
  console.log(`Preparando o build em NTFS: ${stageProject}`);
  await clearStageSources();
  await installStagedDependencies();

  const dataDirectory = join(stageProject, "data");
  await mkdir(dataDirectory, { recursive: true });
  const databasePath = join(dataDirectory, "hub-build.sqlite");
  for (const suffix of ["", "-shm", "-wal"]) {
    await rm(databasePath + suffix, { force: true });
  }

  const env = await loadWorkspaceEnvironment({ DATABASE_PATH: databasePath });
  env.SITE_URL ||= "http://127.0.0.1:3005";
  env.BETTER_AUTH_SECRET ||= randomBytes(48).toString("base64url");
  const migrate = await run(
    process.execPath,
    ["--experimental-strip-types", "scripts/migrate.ts"],
    stageProject,
    env,
  );
  if (migrate.code !== 0) throw new Error("A migração do banco temporário de build falhou.");

  const result = await run(
    process.execPath,
    [join(stageProject, "node_modules", "next", "dist", "bin", "next"), "build", "--webpack"],
    stageProject,
    env,
  );
  if (result.code !== 0) throw new Error("O build em NTFS falhou.");
  await copyBuiltOutput();
}

async function main() {
  const filesystem = getFilesystem(workspace);
  if (process.platform === "win32" && (filesystem === "FAT32" || filesystem === "EXFAT")) {
    await buildOnNtfs();
    return;
  }

  const nextCli = resolve(workspace, "node_modules", "next", "dist", "bin", "next");
  const result = await run(process.execPath, [nextCli, "build", "--webpack"], workspace);
  if (result.code === 0) return;
  if (process.platform === "win32" && isFilesystemError(result.output)) {
    console.log("O volume atual não permite a operação de arquivos do build; repetindo em NTFS.");
    await buildOnNtfs();
    return;
  }
  process.exitCode = result.code;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
