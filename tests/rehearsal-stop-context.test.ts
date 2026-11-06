import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { gitBash, toPosixPath } from "./support/bash.ts";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const stopScript = resolve(repositoryRoot, "infra/stop-rehearsal-worker.sh");
function createFixture(endpoint: string) {
  const root = mkdtempSync(join(tmpdir(), "hub-rehearsal-context-"));
  const fakeBin = join(root, "fake-bin");
  mkdirSync(fakeBin, { recursive: true });
  writeFileSync(join(root, "compose.yaml"), "services: {}\n");
  writeFileSync(join(root, ".env"), "APP_VERSION=0.12.17\n");
  writeFileSync(
    join(root, "bash-env.sh"),
    "id() { [[ \"$1\" == -un ]] && { printf 'hub\\n'; return 0; }; return 1; }\n",
  );

  const dockerPath = join(fakeBin, "docker");
  writeFileSync(
    dockerPath,
    `#!/usr/bin/env bash
set -euo pipefail
printf 'context=%s|host=%s|config=%s|args=%s\\n' "\${DOCKER_CONTEXT:-<unset>}" "\${DOCKER_HOST:-<unset>}" "\${DOCKER_CONFIG:-<unset>}" "$*" >> "$FIXTURE_ROOT/docker.log"
if [[ "$1" == context && "$2" == inspect ]]; then printf '%s\\n' "$FAKE_DOCKER_ENDPOINT"; exit 0; fi
if [[ "$1" == info ]]; then exit 41; fi
exit 90
`,
  );
  chmodSync(dockerPath, 0o755);

  return { root, fakeBin, endpoint };
}

function runFixture(fixture: ReturnType<typeof createFixture>) {
  return spawnSync(
    gitBash,
    [
      stopScript,
      "--project",
      "hub-phase4-20261106-0200",
      "--compose-file",
      toPosixPath(join(fixture.root, "compose.yaml")),
      "--env-file",
      toPosixPath(join(fixture.root, ".env")),
      "--inspect-only",
    ],
    {
      encoding: "utf8",
      windowsHide: true,
      env: {
        ...process.env,
        PATH: `${toPosixPath(fixture.fakeBin)}:${process.env.PATH ?? ""}`,
        FIXTURE_ROOT: toPosixPath(fixture.root),
        FAKE_DOCKER_ENDPOINT: fixture.endpoint,
        BASH_ENV: toPosixPath(join(fixture.root, "bash-env.sh")),
        DOCKER_CONTEXT: "remote-selected-context",
        DOCKER_HOST: "tcp://198.51.100.42:2376",
        DOCKER_CONFIG: toPosixPath(join(fixture.root, "untrusted-docker-config")),
      },
    },
  );
}

test("rehearsal stop ignores a persisted remote context and pins the local Docker socket", () => {
  const fixture = createFixture("unix:///var/run/docker.sock");
  try {
    const result = runFixture(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ERROR=DOCKER_DAEMON_UNAVAILABLE/);
    const calls = readFileSync(join(fixture.root, "docker.log"), "utf8");
    assert.match(
      calls,
      /context=default\|host=<unset>\|config=<unset>\|args=context inspect default/,
    );
    assert.match(calls, /context=default\|host=<unset>\|config=<unset>\|args=info/);
    assert.doesNotMatch(calls, /remote-selected-context|198\.51\.100\.42|untrusted-docker-config/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("rehearsal stop fails closed when the default context endpoint is not local", () => {
  const fixture = createFixture("ssh://docker.example.test");
  try {
    const result = runFixture(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ERROR=DOCKER_ENDPOINT_NOT_LOCAL/);
    const calls = readFileSync(join(fixture.root, "docker.log"), "utf8");
    assert.match(calls, /args=context inspect default/);
    assert.doesNotMatch(calls, /args=info|args=compose/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});
