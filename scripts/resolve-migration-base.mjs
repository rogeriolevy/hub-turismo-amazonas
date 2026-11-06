#!/usr/bin/env node

import { spawnSync } from "node:child_process";

function git(args) {
  return spawnSync("git", args, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
}

function resolveCommit(ref) {
  const direct = git(["rev-parse", "--verify", "--quiet", "--end-of-options", `${ref}^{commit}`]);
  if (direct.status === 0) {
    return direct.stdout.trim();
  }

  const branch = git(["check-ref-format", "--branch", ref]);
  if (branch.status !== 0) {
    return null;
  }

  const branchName = branch.stdout.trim();
  const remote = git([
    "rev-parse",
    "--verify",
    "--quiet",
    "--end-of-options",
    `refs/remotes/origin/${branchName}^{commit}`,
  ]);
  return remote.status === 0 ? remote.stdout.trim() : null;
}

function isZeroRevision(revision) {
  return /^0+$/.test(revision);
}

function selectBase(env) {
  if (env.PULL_REQUEST_BASE) {
    return { ref: env.PULL_REQUEST_BASE, firstPush: false };
  }

  if (env.PUSH_BEFORE && !isZeroRevision(env.PUSH_BEFORE)) {
    return { ref: env.PUSH_BEFORE, firstPush: false };
  }

  if (env.MANUAL_BASE) {
    return { ref: env.MANUAL_BASE, firstPush: false, manual: true };
  }

  if (!env.DEFAULT_BRANCH) {
    throw new Error("no migration base was supplied and the repository has no default branch");
  }

  return {
    ref: `origin/${env.DEFAULT_BRANCH}`,
    firstPush: Boolean(env.PUSH_BEFORE && isZeroRevision(env.PUSH_BEFORE)),
  };
}

function main() {
  let selection;
  try {
    selection = selectBase(process.env);
  } catch (error) {
    console.error(`Could not select migration guard base: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const baseCommit = resolveCommit(selection.ref);
  if (baseCommit) {
    if (selection.manual) {
      const headCommit = resolveCommit("HEAD");
      const mergeBase = git(["merge-base", headCommit, baseCommit]);
      if (mergeBase.status !== 0) {
        console.error(
          "Manual migration guard base has no common history with the selected run commit; provide a related base branch or commit.",
        );
        process.exitCode = 1;
        return;
      }
      if (mergeBase.stdout.trim() === headCommit) {
        console.error(
          "Manual migration guard base is not earlier than the selected run commit; provide a base with an earlier merge base.",
        );
        process.exitCode = 1;
        return;
      }
    }

    process.stdout.write(`${baseCommit}\n`);
    return;
  }

  // An initial push to a newly created repository has no prior commit and may not yet have
  // an origin/<default-branch> ref. In that case HEAD is the only honest empty-baseline base.
  if (selection.firstPush) {
    const head = resolveCommit("HEAD");
    if (head) {
      process.stdout.write(`${head}\n`);
      return;
    }
  }

  console.error(`Could not resolve migration guard base '${selection.ref}' to a commit`);
  process.exitCode = 1;
}

main();
