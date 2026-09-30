import { test } from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import type { ReadStream, WriteStream } from "node:tty";
import { readPassword, newPassword } from "../scripts/password-prompt.ts";

function terminal() {
  const input = Object.assign(new PassThrough(), {
    isTTY: true,
    isRaw: false,
    setRawMode(mode: boolean) {
      this.isRaw = mode;
      return this;
    },
  });
  const output = new PassThrough();
  let display = "";
  output.on("data", (chunk) => {
    display += chunk.toString();
  });
  return {
    input,
    output,
    display: () => display,
    stdin: input as unknown as ReadStream,
    stdout: output as unknown as WriteStream,
  };
}

test("terminal preserves accents, spaces and shell symbols without exposing the password", async () => {
  const tty = terminal();
  const password = ' Árvore@"$`\\2026! ';
  const result = readPassword("Senha: ", tty.stdin, tty.stdout);
  tty.input.write(password + "\r");
  assert.equal(await result, password);
  assert.ok(!tty.display().includes(password));
  assert.match(tty.display(), /\*+/);
  assert.equal(tty.input.isRaw, false);
});

test("backspace removes an entire unicode character, Ctrl+U clears and arrows do not alter input", async () => {
  const tty = terminal();
  const result = readPassword("Senha: ", tty.stdin, tty.stdout);
  tty.input.write("descartar\u0015árvore🌳\u007f\u001b[D2026\n");
  assert.equal(await result, "árvore2026");
});

test("oversized input is rejected instead of silently truncated into a valid password", async () => {
  const tty = terminal();
  const result = newPassword(tty.stdin, tty.stdout);
  const rejected = assert.rejects(result, /12 e 128/);
  tty.input.write("x".repeat(129) + "\r");
  await rejected;
  assert.ok(!tty.display().includes("Confirme"));
});

test("confirmation must match exactly, including spaces", async () => {
  const tty = terminal();
  const result = newPassword(tty.stdin, tty.stdout);
  const rejected = assert.rejects(result, /não coincidem/);
  tty.input.write("Senha-Apenas-Teste! \r");
  await new Promise<void>((resolve) => setImmediate(resolve));
  tty.input.write("Senha-Apenas-Teste!\r");
  await rejected;
});

test("Ctrl+C cancels without leaving raw mode enabled", async () => {
  const tty = terminal();
  const result = readPassword("Senha: ", tty.stdin, tty.stdout);
  const rejected = assert.rejects(result, /cancelada/);
  tty.input.write("\u0003");
  await rejected;
  assert.equal(tty.input.isRaw, false);
});

test("passwords cannot be supplied through a pipe", async () => {
  const tty = terminal();
  tty.input.isTTY = false;
  await assert.rejects(readPassword("Senha: ", tty.stdin, tty.stdout), /terminal interativo/);
});
