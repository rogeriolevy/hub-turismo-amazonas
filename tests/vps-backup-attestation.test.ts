import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const exportScript = readFileSync(resolve(root, "infra/export-vps-backup-to-local.ps1"), "utf8");
const verifyScript = readFileSync(resolve(root, "infra/verify-vps-local-backup.ps1"), "utf8");
const prepareScript = readFileSync(
  resolve(root, "infra/prepare-and-verify-vps-backup.ps1"),
  "utf8",
);

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function createFixture() {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "hub-vps-backup-attestation-"));
  const fakeBin = join(fixtureRoot, "fake-bin");
  const remote = join(fixtureRoot, "remote");
  const backupRoot = join(fixtureRoot, "backups");
  const localAppData = join(fixtureRoot, "localappdata");
  const temp = join(fixtureRoot, "temp");
  for (const directory of [fakeBin, remote, backupRoot, localAppData, temp])
    mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(fixtureRoot, ".hub-vps-backup-attestation-fixture"),
    "hub-vps-backup-attestation-fixture-v1\n",
  );
  const dumpName = "hub-20261105T120000Z-4242.dump";
  const dump = "PGDMP-fixture-archive\n";
  const source =
    '{"schema":"hub-postgres-source-v1","capturedAtUtc":"2026-11-05T12:00:00.000Z","counts":{"accounts":"1"},"ledgerSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","releaseVersion":"0.12.16"}';
  writeFileSync(join(remote, dumpName), dump);
  writeFileSync(join(remote, `${dumpName}.sha256`), `${sha256(dump)}\n`);
  writeFileSync(join(remote, "hub-20261105T120000Z-4242.source.json"), source);
  writeFileSync(
    join(remote, "hub-20261105T120000Z-4242.source.json.sha256"),
    `${sha256(source)}\n`,
  );
  const fakeRunner = `import { appendFileSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
const root = process.env.FIXTURE_ROOT;
const args = process.argv.slice(2);
const command = process.env.FAKE_COMMAND;
if (!root || !existsSync(join(root, ".hub-vps-backup-attestation-fixture"))) process.exit(90);
process.on("uncaughtException", (error) => { appendFileSync(join(root, "calls.log"), "error|" + error.stack + "\\n"); process.exit(99); });
appendFileSync(join(root, "calls.log"), command + "|" + args.join("|") + "\\n");
if (command === "scp") {
  const destination = args.at(-1) ?? "";
  if (!destination.startsWith("fixture-vps:")) {
    mkdirSync(destination, { recursive: true });
    for (const source of args.filter((value) => value.startsWith("fixture-vps:"))) copyFileSync(join(root, "remote", basename(source)), join(destination, basename(source)));
  }
  process.exit(0);
}
const remoteCommand = args.at(-1) ?? "";
let decoded = remoteCommand;
const match = /printf '%s' '([^']+)'/.exec(remoteCommand);
if (match) decoded = Buffer.from(match[1], "base64").toString("utf8");
if (decoded.includes('candidate="$(find')) {
  const dump = "hub-20261105T120000Z-4242.dump";
  const contents = await import("node:fs/promises");
  const dumpBody = await contents.readFile(join(root, "remote", dump), "utf8");
  const sourceBody = await contents.readFile(join(root, "remote", dump.replace(".dump", ".source.json")), "utf8");
  const crypto = await import("node:crypto");
  console.log([dump, crypto.createHash("sha256").update(dumpBody).digest("hex"), Buffer.byteLength(dumpBody), dump.replace(".dump", ".source.json"), crypto.createHash("sha256").update(sourceBody).digest("hex")].join("|"));
} else if (remoteCommand.includes("restore-local-backup.sh")) {
  const scenario = process.env.FAKE_SCENARIO ?? "success";
  console.log(scenario === "mismatch" ? "RESTORE_SOURCE_COMPARISON=mismatch" : "RESTORE_SOURCE_COMPARISON=match");
  console.log(scenario === "cleanup" ? "RESTORE_DATABASE_CLEANUP=failed" : "RESTORE_DATABASE_CLEANUP=ok");
  console.log(scenario === "cleanup" ? "REMOTE_STAGING_CLEANUP=failed" : "REMOTE_STAGING_CLEANUP=ok");
} else if (decoded.includes("PACKAGE_VERSION")) {
  console.log("0.12.16|sha256:fixture-image");
}
`;
  writeFileSync(join(fakeBin, "fake-runner.mjs"), fakeRunner);
  const isWindows = process.platform === "win32";
  for (const command of ["ssh", "scp"]) {
    const extension = isWindows ? ".cmd" : "";
    const wrapper = isWindows
      ? "@echo off\r\nREM hub-vps-backup-attestation-fake-v1\r\nset FAKE_COMMAND=" +
        command +
        '\r\nnode "%~dp0fake-runner.mjs" %*\r\n'
      : "#!/bin/sh\n# hub-vps-backup-attestation-fake-v1\nexport FAKE_COMMAND=" +
        command +
        '\nexec node "$(dirname "$0")/fake-runner.mjs" "$@"\n';
    writeFileSync(
      join(fakeBin, command + extension),
      wrapper,
      isWindows ? undefined : { mode: 0o755 },
    );
  }
  return { fixtureRoot, fakeBin, backupRoot, localAppData, temp };
}

function runPrepare(fixture: ReturnType<typeof createFixture>, scenario = "success") {
  return spawnSync(
    process.env.POWERSHELL_EXE ?? (process.platform === "win32" ? "pwsh.exe" : "pwsh"),
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      resolve(root, "infra/prepare-and-verify-vps-backup.ps1"),
      "-BackupDirectory",
      fixture.backupRoot,
      "-CandidateAttestationPath",
      "/opt/hub-turismo/attestations/candidate-0.12.16.env",
      "-CandidateAttestationSha256",
      "b".repeat(64),
      "-ConfirmLocalBackup",
      "-TestOnly",
      "-FixtureRoot",
      fixture.fixtureRoot,
      "-FakeBin",
      fixture.fakeBin,
    ],
    {
      encoding: "utf8",
      windowsHide: true,
      env: {
        ...process.env,
        FIXTURE_ROOT: fixture.fixtureRoot,
        FAKE_SCENARIO: scenario,
        LOCALAPPDATA: fixture.localAppData,
        TEMP: fixture.temp,
      },
    },
  );
}

test("export fixture contract requires a complete dump and source receipt set", () => {
  assert.ok(exportScript.includes("source_receipt_path"), "source receipt remote path is required");
  assert.ok(
    exportScript.includes("LOCAL_SOURCE_RECEIPT_FILE="),
    "source receipt marker is required",
  );
  assert.ok(exportScript.includes("sourceReceiptSha256"), "source receipt hash is required");
});

test("restore fixture contract compares canonical source facts before a pass marker", () => {
  assert.ok(
    verifyScript.includes("RESTORE_SOURCE_COMPARISON=match"),
    "exact comparison marker is required",
  );
  assert.ok(
    verifyScript.includes("CandidateAttestationSha256"),
    "candidate hash input is required",
  );
  assert.ok(
    verifyScript.includes("BACKUP_ATTESTATION_EXPIRES_AT_UTC="),
    "expiry marker is required",
  );
});

test("candidate mismatch or cleanup failure cannot produce an activation attestation", () => {
  assert.ok(verifyScript.includes("RESTORE_DATABASE_CLEANUP=ok"));
  assert.ok(verifyScript.includes("REMOTE_STAGING_CLEANUP=ok"));
  assert.ok(verifyScript.includes("CANDIDATE_ATTESTATION_SHA256"));
  assert.ok(verifyScript.includes("AddMinutes(60)"));
});

test("prepare workflow forwards the exact candidate attestation inputs", () => {
  assert.ok(prepareScript.includes("CandidateAttestationPath"));
  assert.ok(prepareScript.includes("CandidateAttestationSha256"));
  assert.ok(prepareScript.includes("LOCAL_SOURCE_RECEIPT_FILE="));
});

test("sentinel fake ssh/scp fixture proves export, parity, cleanup, and candidate-bound activation evidence", () => {
  const fixture = createFixture();
  try {
    const result = runPrepare(fixture);
    const debugCalls = existsSync(join(fixture.fixtureRoot, "calls.log"))
      ? readFileSync(join(fixture.fixtureRoot, "calls.log"), "utf8")
      : "<no fake calls>";
    assert.equal(result.status, 0, `${result.stderr}\n${debugCalls}`);
    assert.match(result.stdout, /LOCAL_BACKUP_FILE=/);
    assert.match(result.stdout, /LOCAL_SOURCE_RECEIPT_FILE=/);
    assert.match(result.stdout, /RESTORE_SOURCE_COMPARISON=match/);
    assert.match(
      result.stdout,
      /BACKUP_ATTESTATION_REMOTE_PATH=\/opt\/hub-turismo\/attestations\/backup-/,
    );
    assert.match(result.stdout, /BACKUP_ATTESTATION_EXPIRES_AT_UTC=/);
    const calls = readFileSync(join(fixture.fixtureRoot, "calls.log"), "utf8");
    assert.match(calls, /^scp\|.*hub-20261105T120000Z-4242\.source\.json/m);
    assert.match(calls, /^ssh\|.*restore-local-backup\.sh/m);
  } finally {
    rmSync(fixture.fixtureRoot, { recursive: true, force: true });
  }
});

for (const scenario of ["mismatch", "cleanup"]) {
  test(`sentinel fake ${scenario} leaves no backup activation attestation`, () => {
    const fixture = createFixture();
    try {
      const result = runPrepare(fixture, scenario);
      assert.notEqual(result.status, 0);
      assert.doesNotMatch(result.stdout, /BACKUP_ATTESTATION_REMOTE_PATH=/);
      const attestationDirectory = join(
        fixture.localAppData,
        "HubTurismo",
        "BackupReceipts",
        "BackupActivationAttestations",
      );
      assert.ok(
        !existsSync(attestationDirectory) || readdirSync(attestationDirectory).length === 0,
      );
      const calls = existsSync(join(fixture.fixtureRoot, "calls.log"))
        ? readFileSync(join(fixture.fixtureRoot, "calls.log"), "utf8")
        : "";
      assert.doesNotMatch(calls, /backup-[a-f0-9]{64}\.env/);
    } finally {
      rmSync(fixture.fixtureRoot, { recursive: true, force: true });
    }
  });
}
