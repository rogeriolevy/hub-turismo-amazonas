import { emitKeypressEvents, type Key } from "node:readline";
import type { ReadStream, WriteStream } from "node:tty";

export async function readPassword(
  label: string,
  input: ReadStream = process.stdin,
  output: WriteStream = process.stdout,
): Promise<string> {
  if (!input.isTTY)
    throw new Error(
      "Execute este comando em um terminal interativo. Não passe senhas pela linha de comando.",
    );
  output.write(label);
  emitKeypressEvents(input);
  const wasRaw = input.isRaw;
  input.setRawMode(true);
  input.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const cleanup = () => {
      input.removeListener("keypress", onKey);
      input.setRawMode(wasRaw);
      input.pause();
      output.write("\n");
    };
    const onKey = (text: string, key: Key) => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        reject(new Error("Operação cancelada."));
      } else if (key.name === "return" || key.name === "enter") {
        cleanup();
        resolve(value);
      } else if (key.name === "backspace") {
        if (value) {
          value = Array.from(value).slice(0, -1).join("");
          output.write("\b \b");
        }
      } else if (key.ctrl && key.name === "u") {
        output.write("\b \b".repeat(Array.from(value).length));
        value = "";
      } else if (text && !key.ctrl && !/[\x00-\x1f\x7f]/.test(text)) {
        // Validate the full input later; silently truncating creates a different password.
        value += text;
        output.write("*".repeat(Array.from(text).length));
      }
    };
    input.on("keypress", onKey);
  });
}
export async function newPassword(
  input: ReadStream = process.stdin,
  output: WriteStream = process.stdout,
) {
  output.write(
    "A senha diferencia maiúsculas e minúsculas; espaços também contam.\nUse Backspace para apagar ou Ctrl+U para limpar a digitação.\n",
  );
  const password = await readPassword("Nova senha (12 a 128 caracteres): ", input, output);
  if (password.length < 12 || password.length > 128)
    throw new Error("Use entre 12 e 128 caracteres.");
  if (password !== (await readPassword("Confirme a senha: ", input, output)))
    throw new Error("As senhas não coincidem.");
  return password;
}
