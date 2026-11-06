import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const exportScript = readFileSync(resolve(root, "infra/export-vps-backup-to-local.ps1"), "utf8");
const verifyScript = readFileSync(resolve(root, "infra/verify-vps-local-backup.ps1"), "utf8");
const prepareScript = readFileSync(resolve(root, "infra/prepare-and-verify-vps-backup.ps1"), "utf8");

test("export fixture contract requires a complete dump and source receipt set", () => {
  assert.ok(exportScript.includes("sourceReceiptPath"), "source receipt remote path is required");
  assert.ok(exportScript.includes("LOCAL_SOURCE_RECEIPT_FILE="), "source receipt marker is required");
  assert.ok(exportScript.includes("sourceReceiptSha256"), "source receipt hash is required");
});

test("restore fixture contract compares canonical source facts before a pass marker", () => {
  assert.ok(verifyScript.includes("RESTORE_SOURCE_COMPARISON=match"), "exact comparison marker is required");
  assert.ok(verifyScript.includes("CandidateAttestationSha256"), "candidate hash input is required");
  assert.ok(verifyScript.includes("BACKUP_ATTESTATION_EXPIRES_AT_UTC="), "expiry marker is required");
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
