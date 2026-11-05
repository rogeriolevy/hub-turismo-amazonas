#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const migrationRoots = ["db/migrations/", "db/postgres-migrations/"];

function fail(message) {
  console.error(`Migration immutability check failed: ${message}`);
  process.exitCode = 1;
}

function git(args, options = {}) {
  const result = spawnSync("git", args, {
    encoding: "buffer",
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  });

  if (result.error) {
    throw new Error(`could not run git: ${result.error.message}`);
  }

  return result;
}

function parseBaseRef(args) {
  const index = args.indexOf("--base-ref");
  if (index === -1 || !args[index + 1] || args[index + 1].startsWith("--")) {
    throw new Error("provide a base revision with --base-ref <revision>");
  }

  if (args.indexOf("--base-ref", index + 1) !== -1) {
    throw new Error("provide --base-ref only once");
  }

  return args[index + 1];
}

function run() {
  let baseRef;
  try {
    baseRef = parseBaseRef(process.argv.slice(2));
  } catch (error) {
    fail(error.message);
    return;
  }

  const resolved = git(["rev-parse", "--verify", "--end-of-options", `${baseRef}^{commit}`]);
  if (resolved.status !== 0) {
    fail(`base revision '${baseRef}' cannot be resolved to a commit`);
    return;
  }

  const baseCommit = resolved.stdout.toString("utf8").trim();
  const mergeBaseResult = git(["merge-base", baseCommit, "HEAD"]);
  if (mergeBaseResult.status !== 0) {
    fail(`base revision '${baseRef}' has no merge base with HEAD`);
    return;
  }

  const mergeBase = mergeBaseResult.stdout.toString("utf8").trim();
  const tree = git(["ls-tree", "-r", "-z", "--name-only", mergeBase, "--", ...migrationRoots]);
  if (tree.status !== 0) {
    fail(`could not list migrations at merge base ${mergeBase}`);
    return;
  }

  const baselinePaths = tree.stdout
    .toString("utf8")
    .split("\0")
    .filter((path) => path.endsWith(".sql"));
  const changedPaths = [];

  for (const path of baselinePaths) {
    const diff = git(["diff", "--quiet", mergeBase, "--", `:(literal)${path}`]);
    if (diff.status === 1) {
      changedPaths.push(path);
    } else if (diff.status !== 0) {
      fail(`could not compare migration '${path}' with merge base ${mergeBase}`);
      return;
    }
  }

  if (changedPaths.length > 0) {
    fail(`existing migration paths were modified, deleted, or renamed:\n${changedPaths.map((path) => `  - ${path}`).join("\n")}`);
    return;
  }

  console.log(`Migration immutability check passed (${baselinePaths.length} baseline SQL file(s), merge base ${mergeBase}).`);
}

run();
