import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import type { Inspection, Preview } from "../lib/cadastur-schema.ts";
export async function verifyCadasturHttp(base: string, root: string, visitor: string) {
  const endpoint = "/api/cadastur/";
  const csv =
    "Certificado;Nome;UF;Município\n00123456000199;Hospedagem fictícia Cadastur;AM;Manaus";
  const request = (action: string, data: unknown, cookie = root, origin = base) =>
    fetch(base + endpoint + action, {
      method: "POST",
      headers: { "content-type": "application/json", origin, cookie },
      body: JSON.stringify(data),
    });
  const upload = (
    action: string,
    config: unknown,
    cookie = root,
    content: Blob = new Blob([csv]),
    filename = "teste.csv",
  ) => {
    const body = new FormData();
    body.set("config", JSON.stringify(config));
    body.set("file", content, filename);
    return fetch(base + endpoint + action, {
      method: "POST",
      headers: { cookie, origin: base },
      body,
    });
  };
  assert.equal((await fetch(base + endpoint + "registros?category=hospedagens")).status, 401);
  assert.equal(
    (
      await fetch(base + endpoint + "registros?category=hospedagens", {
        headers: { cookie: visitor },
      })
    ).status,
    403,
  );
  assert.equal((await request("inspecionar", {}, root, "https://outside.example")).status, 403);
  assert.equal((await upload("inspecionar", { category: "hospedagens" }, visitor)).status, 403);
  assert.equal(
    (await upload("inspecionar", { category: "hospedagens" }, root, new Blob([csv]), "unsafe.exe"))
      .status,
    415,
  );
  const read = await upload("inspecionar", { category: "hospedagens" });
  assert.equal(read.status, 200);
  const inspection = (await read.json()).data as Inspection;
  assert.equal(inspection.rows, 1);
  assert.ok(!("data" in inspection));
  const config = {
    category: "hospedagens",
    period: "2026-T2",
    uf: "AM",
    city: "",
    sheet: inspection.sheet,
    mapping: inspection.mapping,
    checksum: inspection.checksum,
  };
  const changed = await upload("prever", { ...config, checksum: "0".repeat(64) });
  assert.equal(changed.status, 409);
  const result = await upload("prever", config);
  assert.equal(result.status, 200);
  const preview = (await result.json()).data as Preview;
  assert.equal(preview.counts.added, 1);
  assert.equal((await request("confirmar", { id: preview.id }, visitor)).status, 403);
  assert.equal((await request("confirmar", { id: preview.id })).status, 200);
  assert.equal((await request("confirmar", { id: preview.id })).status, 200);
  const directory = await fetch(base + endpoint + "registros?category=hospedagens", {
    headers: { cookie: root },
  });
  const entries = (await directory.json()).data;
  assert.equal(entries.total, 1);
  assert.equal((await request("revisar", { id: entries.entries[0].id })).status, 200);
  const bytes = await readFile(new URL("./fixtures/cadastur-ficticio.xlsx", import.meta.url));
  const excel = await upload(
    "inspecionar",
    { category: "guias", sheet: "Guias PF" },
    root,
    new Blob([bytes]),
    "guias.xlsx",
  );
  assert.equal(excel.status, 200);
  assert.equal((await excel.json()).data.sheet, "Guias PF");
  const page = await fetch(base + "/painel/plataforma/cadastur", { headers: { cookie: root } });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Cadastur, conectado/);
  const blocked = await fetch(base + "/painel/plataforma/cadastur", {
    headers: { cookie: visitor },
  });
  assert.ok(!(await blocked.text()).includes("Hospedagem fictícia Cadastur"));
  console.log(
    "PASS: Cadastur HTTP, CSV/XLSX, prévia, confirmação idempotente, revisão, origem, checksum e acesso exclusivo do administrador.",
  );
}
