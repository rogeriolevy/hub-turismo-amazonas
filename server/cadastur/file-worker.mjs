import { parentPort, workerData } from "node:worker_threads";
import readXlsx from "read-excel-file/node";
import { parse } from "csv-parse/sync";
import { Parse } from "unzipper-esm";
import { Readable } from "node:stream";

// Check actual decompressed bytes before the workbook parser allocates XML buffers.
async function checkArchive(buffer) {
  const zip = Readable.from([buffer]).pipe(Parse({ forceStream: true }));
  let actual = 0,
    declared = 0,
    files = 0;
  const limit = 160 * 1024 * 1024;
  try {
    for await (const entry of zip) {
      files++;
      declared += entry.vars.uncompressedSize || 0;
      if (files > 1000 || declared > limit) throw Error("LIMIT");
      for await (const chunk of entry) {
        actual += chunk.length;
        if (actual > limit) throw Error("LIMIT");
      }
    }
  } finally {
    zip.destroy();
  }
}

try {
  const buffer = Buffer.from(workerData.bytes);
  let sheets;
  if (workerData.format === "xlsx") {
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) throw Error("INVALID");
    await checkArchive(buffer);
    sheets = await readXlsx(buffer);
  } else {
    let text;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      text = new TextDecoder("windows-1252").decode(buffer);
    }
    if (text.includes("\0")) throw Error("INVALID");
    const head = text.split(/\r?\n/, 1)[0];
    const delimiter = [";", ",", "\t"].sort(
      (a, b) => head.split(b).length - head.split(a).length,
    )[0];
    const data = parse(text, {
      delimiter,
      bom: true,
      skip_empty_lines: true,
      trim: true,
      max_record_size: 65536,
      on_record(record, info) {
        if (info.records > 100001 || record.length > 100) throw Error("LIMIT");
        return record;
      },
    });
    sheets = [{ sheet: "CSV", data }];
  }
  if (sheets.length > 10 || sheets.reduce((n, s) => n + s.data.length, 0) > 100001)
    throw Error("LIMIT");
  const selected =
    workerData.sheet === "1" ? sheets[0] : sheets.find((s) => s.sheet === workerData.sheet);
  if (!selected || !selected.data.length) throw Error("SHEET");
  const data = selected.data.map((row) => {
    if (row.length > 100) throw Error("LIMIT");
    return Array.from(row, (value) => {
      const text =
        value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? "").trim();
      if (text.length > 10000) throw Error("LIMIT");
      return text;
    });
  });
  parentPort.postMessage({
    ok: true,
    data,
    sheet: selected.sheet,
    sheets: sheets.map((s) => ({ name: s.sheet, rows: Math.max(0, s.data.length - 1) })),
  });
} catch {
  parentPort.postMessage({ ok: false });
}
