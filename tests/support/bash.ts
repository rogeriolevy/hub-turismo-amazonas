import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

export const gitBash =
  process.env.GIT_BASH_EXE ??
  (process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash");

export function toPosixPath(value: string): string {
  if (process.platform !== "win32") return value.replaceAll("\\", "/");

  const cygpath = process.env.CYGPATH_EXE ?? "C:/Program Files/Git/usr/bin/cygpath.exe";
  const result = spawnSync(cygpath, ["-u", value], { encoding: "utf8", windowsHide: true });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
