import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const executor = path.join(repositoryRoot, "infra", "verify-and-build-vps-release.sh");
const gitBash = process.env.GIT_BASH_EXE ?? "C:/Program Files/Git/bin/bash.exe";
const cygpath = process.env.CYGPATH_EXE ?? "C:/Program Files/Git/usr/bin/cygpath.exe";
const fixtureDirectories: string[] = [];
const head = "a".repeat(40);
const tree = "b".repeat(40);

function sha256(contents: string | Buffer) {
  return createHash("sha256").update(contents).digest("hex");
}

function runCommand(file: string, args: string[]) {
  const result = spawnSync(file, args, { encoding: "utf8", windowsHide: true });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr || `Command exited ${result.status}`);
  return result.stdout.trim();
}

const fakeDocker = `#!/usr/bin/env bash
set -euo pipefail
printf 'docker' >> "$FIXTURE_ROOT/calls.log"
for argument in "$@"; do printf '|%s' "$argument" >> "$FIXTURE_ROOT/calls.log"; done
printf '\\n' >> "$FIXTURE_ROOT/calls.log"

if [[ "$1" == run ]]; then
  [[ " $* " == *" --network none "* && " $* " == *" --read-only "* && " $* " == *" --self-check "* ]] || exit 41
  case "\${HUB_VERIFY_BUILD_SCENARIO:-}" in git-mismatch|manifest-mismatch) exit 42 ;; esac
  exit 0
fi
if [[ "$1" == compose ]]; then
  [[ " $* " == *" build web "* ]] || exit 43
  printf 'build|web\\n' >> "$FIXTURE_ROOT/calls.log"
  exit 0
fi
if [[ "$1" == image && "$2" == inspect ]]; then
  printf 'sha256:fixture-image\\n'
  exit 0
fi
exit 44
`;

const fakeUnzip = `#!/usr/bin/env bash
set -euo pipefail
printf 'unzip\\n' >> "$FIXTURE_ROOT/calls.log"
[[ "$1" == -q && "$3" == -d ]] || exit 51
target="$4"
mkdir -p "$target/infra" "$target/db/migrations" "$target/db/postgres-migrations"
printf '{"name":"hub-turismo-amazonas","version":"1.2.3"}\\n' > "$target/package.json"
printf 'services: {}\\n' > "$target/infra/compose.vps.yaml"
printf 'SELECT 1;\\n' > "$target/db/migrations/001-fixture.sql"
printf 'SELECT 2;\\n' > "$target/db/postgres-migrations/002-fixture.sql"
`;

async function createFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "hub-vps-verify-build-"));
  fixtureDirectories.push(root);
  const posixRoot = runCommand(cygpath, ["-u", root]);
  const staging = path.join(root, "staging");
  const fakeBin = path.join(root, "fake-bin");
  const current = path.join(root, "current");
  await mkdir(staging, { recursive: true });
  await mkdir(fakeBin, { recursive: true });
  await mkdir(path.join(current, "infra"), { recursive: true });
  await writeFile(path.join(root, ".hub-verify-build-fixture"), "hub-verify-build-test-fixture-v1\\n");
  await writeFile(path.join(fakeBin, ".hub-fake-runtime"), "hub-verify-build-fake-runtime-v1\\n");
  await writeFile(path.join(fakeBin, "docker"), fakeDocker);
  await writeFile(path.join(fakeBin, "unzip"), fakeUnzip);
  await chmod(path.join(fakeBin, "docker"), 0o755);
  await chmod(path.join(fakeBin, "unzip"), 0o755);
  await writeFile(path.join(current, "infra", "vps.env"), "APP_VERSION=0.0.1\\nSITE_URL=https://fixture.invalid\\n");
  await writeFile(path.join(current, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: {} }) + "\\n");
  const archive = path.join(staging, "source.zip");
  const manifest = path.join(staging, "SOURCE-MANIFEST.json");
  const verifier = path.join(staging, "verify-vps-source-snapshot.mjs");
  await writeFile(archive, "fixture-source-archive\\n");
  await writeFile(manifest, JSON.stringify({ format: "fixture" }) + "\\n");
  await writeFile(verifier, "// fixture verifier\\n");
  return { root, posixRoot, archive, manifest, verifier };
}

function runExecutor(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  options: { scenario?: string; archiveHash?: string; verifierHash?: string; gitHead?: string; gitTree?: string } = {},
) {
  const args = [
    executor,
    "--test-only",
    "--fixture-root",
    fixture.posixRoot,
    "--fake-bin",
    runCommand(cygpath, ["-u", path.join(fixture.root, "fake-bin")]),
    "--staging",
    runCommand(cygpath, ["-u", path.join(fixture.root, "staging")]),
    "--archive",
    runCommand(cygpath, ["-u", fixture.archive]),
    "--manifest",
    runCommand(cygpath, ["-u", fixture.manifest]),
    "--verifier",
    runCommand(cygpath, ["-u", fixture.verifier]),
    "--git-head",
    options.gitHead ?? head,
    "--git-tree",
    options.gitTree ?? tree,
    "--archive-sha256",
    options.archiveHash ?? sha256("fixture-source-archive\\n"),
    "--verifier-sha256",
    options.verifierHash ?? sha256("// fixture verifier\\n"),
  ];
  return spawnSync(gitBash, args, {
    encoding: "utf8",
    windowsHide: true,
    env: { ...process.env, FIXTURE_ROOT: fixture.posixRoot, HUB_VERIFY_BUILD_SCENARIO: options.scenario ?? "" },
  });
}

async function calls(fixture: Awaited<ReturnType<typeof createFixture>>) {
  return readFile(path.join(fixture.root, "calls.log"), "utf8").catch(() => "");
}

test("verify-and-build happy path produces one measured candidate attestation", async () => {
  const fixture = await createFixture();
  const result = runExecutor(fixture);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /CANDIDATE_ATTESTATION=.*candidate-1\.2\.3\.env/);
  assert.match(result.stdout, /CANDIDATE_ATTESTATION_SHA256=[a-f0-9]{64}/);
  assert.match(await calls(fixture), /docker\|.*\|run\|.*\|--network\|none.*\|--read-only.*\|--self-check/m);
  assert.match(await calls(fixture), /build\|web/);
  const attestation = await readFile(path.join(fixture.root, "attestations", "candidate-1.2.3.env"), "utf8");
  assert.match(attestation, /CANDIDATE_PATH=.*release-1\.2\.3/);
  assert.match(attestation, /^IMAGE_ID=sha256:fixture-image$/m);
  assert.match(attestation, /^ENVIRONMENT_SHA256=[a-f0-9]{64}$/m);
});

for (const [name, options, error] of [
  ["archive hash", { archiveHash: "0".repeat(64) }, "ARCHIVE_SHA256_MISMATCH"],
  ["verifier hash", { verifierHash: "0".repeat(64) }, "VERIFIER_SHA256_MISMATCH"],
  ["Git pins", { scenario: "git-mismatch" }, "VERIFIER_FAILED"],
  ["manifest", { scenario: "manifest-mismatch" }, "VERIFIER_FAILED"],
] as const) {
  test(`pin mismatch (${name}) stops before extraction, build, and attestation`, async () => {
    const fixture = await createFixture();
    const result = runExecutor(fixture, options);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, new RegExp(`ERROR=${error}`));
    assert.doesNotMatch(await calls(fixture), /^unzip$|build\|web/m);
    await assert.rejects(readFile(path.join(fixture.root, "attestations", "candidate-1.2.3.env")));
  });
}

test("verifier self-check is required and an attestation is never overwritten", async () => {
  const fixture = await createFixture();
  const first = runExecutor(fixture);
  assert.equal(first.status, 0, first.stderr);
  const second = runExecutor(fixture);
  assert.notEqual(second.status, 0);
  assert.match(second.stderr, /ERROR=ATTESTATION_ALREADY_EXISTS/);
});

after(async () => {
  await Promise.all(fixtureDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
});
