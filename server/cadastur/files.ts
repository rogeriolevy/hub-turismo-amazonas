import { Worker } from "node:worker_threads";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { MAX_FILE_BYTES, suggestMapping, type Inspection } from "../../lib/cadastur-schema.ts";
import { HttpError } from "../http.ts";
export type ParsedFile = Inspection & { data: string[][] };
let busy = false;
export async function parseCadasturFile(
  bytes: Uint8Array,
  format: string,
  sheet = "1",
): Promise<ParsedFile> {
  if (!bytes.length || bytes.length > MAX_FILE_BYTES)
    throw new HttpError(413, "FILE_SIZE", "Envie um arquivo de até 20 MB.");
  if (!["csv", "xlsx"].includes(format))
    throw new HttpError(
      415,
      "FILE_TYPE",
      "Use CSV ou XLSX. Para arquivos XLS antigos, salve uma cópia em XLSX.",
    );
  if (busy)
    throw new HttpError(
      409,
      "IMPORT_BUSY",
      "Já existe um arquivo em leitura. Aguarde e tente novamente.",
    );
  busy = true;
  try {
    const result = await new Promise<{
      data: string[][];
      sheet: string;
      sheets: Inspection["sheets"];
    }>((resolveResult, reject) => {
      const worker = new Worker(resolve(process.cwd(), "server/cadastur/file-worker.mjs"), {
        workerData: { bytes, format, sheet },
        execArgv: [],
        resourceLimits: { maxOldGenerationSizeMb: 512 },
      });
      const error = () =>
        reject(
          new HttpError(
            422,
            "INVALID_FILE",
            "Não foi possível ler a planilha. Confira a aba, o formato e os limites de 100 mil linhas e 100 colunas.",
          ),
        );
      const timer = setTimeout(() => {
        error();
        void worker.terminate();
      }, 30000);
      worker.once("message", (message) => {
        clearTimeout(timer);
        if (message.ok) resolveResult(message);
        else error();
        void worker.terminate();
      });
      worker.once("error", () => {
        clearTimeout(timer);
        error();
      });
      worker.once("exit", (code) => {
        clearTimeout(timer);
        if (code !== 0) error();
      });
    });
    const headers = result.data.shift() || [];
    if (headers.length < 4 || headers.some((h) => h.length > 160))
      throw new HttpError(
        422,
        "HEADERS",
        "A primeira linha da aba deve conter os nomes das colunas.",
      );
    return {
      ...result,
      headers,
      rows: result.data.length,
      checksum: createHash("sha256").update(bytes).digest("hex"),
      mapping: suggestMapping(headers),
    };
  } finally {
    busy = false;
  }
}
