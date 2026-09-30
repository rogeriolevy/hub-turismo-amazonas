import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { openDatabase } from "../db/index.ts";
import { migrateDatabase } from "../db/migrate-auth.ts";
import {
  createPreview,
  commitImport,
  reviewEntry,
  listDirectory,
  expirePreviews,
} from "../server/cadastur/service.ts";
import { parseCadasturFile } from "../server/cadastur/files.ts";
import { sourceInfo, safeOfficialUrl, periodFromName } from "../server/cadastur/sources.ts";
import { suggestMapping, type CadasturCategory } from "../lib/cadastur-schema.ts";
import { HttpError } from "../server/http.ts";
import { saveCompany, saveGuide } from "../server/company-service.ts";
process.env.SITE_URL = "http://127.0.0.1:3100";
process.env.BETTER_AUTH_SECRET = randomBytes(48).toString("base64url");
process.env.ADMIN_EMAILS = "admin@example.test,second@example.test";
const denied = (status: number) => (error: unknown) =>
  error instanceof HttpError && error.status === status;
async function fixture() {
  const db = openDatabase(":memory:");
  await migrateDatabase(db);
  const actor = (email: string) => {
    const a = { id: randomUUID(), email, name: "Teste" };
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO "user" (id,name,email,emailVerified,createdAt,updatedAt) VALUES (?,?,?,0,?,?)',
    ).run(a.id, a.name, a.email, now, now);
    return a;
  };
  return {
    db,
    admin: actor("admin@example.test"),
    second: actor("second@example.test"),
    visitor: actor("visitor@example.test"),
  };
}
const header = "Certificado;Nome;UF;Município;Situação Cadastral;CPF;E-mail Comercial";
async function file(rows: string[]) {
  return parseCadasturFile(Buffer.from(header + "\n" + rows.join("\n")), "csv");
}
const line = (id: string, name = "Hotel de Teste", uf = "AM", city = "Manaus") =>
  `${id};${name};${uf};${city};Regular;12345678909;private@example.test`;
const options = (
  f: Awaited<ReturnType<typeof file>>,
  category: CadasturCategory = "hospedagens",
  period = "2026-T2",
) => ({
  category,
  period,
  uf: "AM",
  city: "",
  sheet: f.sheet,
  mapping: f.mapping,
  checksum: f.checksum,
});

test("Cadastur: prévia filtra, confirma de forma idempotente e não cria contas/empresas", async () => {
  const { db, admin } = await fixture();
  try {
    const f = await file([
      line("00123456000199"),
      line("00123456000199"),
      line("00223456000199", "Hotel de Fora", "PA"),
      line("", "Sem registro"),
    ]);
    const p = createPreview(db, admin, f, options(f), sourceInfo("hospedagens"));
    assert.equal(p.counts.added, 1);
    assert.equal(p.counts.duplicates, 1);
    assert.equal(p.counts.filtered, 1);
    assert.equal(p.counts.invalid, 1);
    assert.equal(listDirectory(db, admin, { category: "hospedagens" }).total, 0);
    assert.ok(!JSON.stringify(p).includes("private@example.test"));
    const payload = db
      .prepare<[], { payload: string }>("SELECT payload FROM cadastur_imports")
      .get()!.payload;
    assert.ok(!payload.includes("12345678909") && !payload.includes("private@example.test"));
    const first = commitImport(db, admin, { id: p.id });
    assert.deepEqual(commitImport(db, admin, { id: p.id }), first);
    assert.equal(listDirectory(db, admin, { category: "hospedagens" }).total, 1);
    assert.equal(db.prepare<[], { n: number }>("SELECT COUNT(*) n FROM companies").get()!.n, 0);
    assert.equal(db.prepare<[], { n: number }>('SELECT COUNT(*) n FROM "user"').get()!.n, 3);
    const repeated = createPreview(db, admin, f, options(f), sourceInfo("hospedagens"));
    assert.equal(repeated.counts.unchanged, 1);
    assert.throws(() => commitImport(db, admin, { id: repeated.id }), denied(422));
  } finally {
    db.close();
  }
});
test("Cadastur: rejeita usuário comum, mapeamento pessoal, categoria divergente e prévia de outro administrador", async () => {
  const { db, admin, second, visitor } = await fixture();
  try {
    const f = await file([line("00123456000199")]);
    assert.throws(
      () => createPreview(db, visitor, f, options(f), sourceInfo("hospedagens")),
      denied(403),
    );
    assert.throws(
      () =>
        createPreview(
          db,
          admin,
          f,
          { ...options(f), mapping: { ...f.mapping, external_id: 5 } },
          sourceInfo("hospedagens"),
        ),
      denied(422),
    );
    assert.throws(
      () => createPreview(db, admin, f, options(f, "guias"), sourceInfo("hospedagens")),
      denied(409),
    );
    const p = createPreview(db, admin, f, options(f), sourceInfo("hospedagens"));
    assert.throws(() => commitImport(db, second, { id: p.id }), denied(404));
    assert.throws(() => commitImport(db, visitor, { id: p.id }), denied(403));
    assert.throws(() => reviewEntry(db, visitor, { id: randomUUID() }), denied(403));
    assert.throws(() => listDirectory(db, visitor, { category: "hospedagens" }), denied(403));
  } finally {
    db.close();
  }
});
test("Cadastur: conflito entre duplicatas exclui ambas; certificado de guia de 11 dígitos difere do CPF", async () => {
  const { db, admin } = await fixture();
  try {
    const f = await file([
      line("00123456000199", "Amazônia Hotel"),
      line("00123456000199", "Outro nome"),
    ]);
    const p = createPreview(db, admin, f, options(f), sourceInfo("hospedagens"));
    assert.equal(p.counts.conflicts, 2);
    assert.equal(p.counts.added, 0);
    const guide = await file([
      line("11111111112", "Guia de Teste"),
      line("12345678909", "CPF não permitido"),
    ]);
    const result = createPreview(db, admin, guide, options(guide, "guias"), sourceInfo("guias"));
    assert.equal(result.counts.added, 1);
    assert.equal(result.counts.invalid, 1);
  } finally {
    db.close();
  }
});
test("Cadastur: concorrência não sobrescreve dados, período antigo não regride e expirados são limpos", async () => {
  const { db, admin, second } = await fixture();
  try {
    const f = await file([line("00123456000199")]);
    const first = createPreview(db, admin, f, options(f), sourceInfo("hospedagens"));
    const secondPreview = createPreview(db, second, f, options(f), sourceInfo("hospedagens"));
    commitImport(db, admin, { id: first.id });
    assert.throws(() => commitImport(db, second, { id: secondPreview.id }), denied(409));
    const old = createPreview(
      db,
      admin,
      f,
      options(f, "hospedagens", "2026-T1"),
      sourceInfo("hospedagens"),
    );
    assert.equal(old.counts.older, 1);
    db.prepare("UPDATE cadastur_imports SET expires_at='2000-01-01' WHERE status='preview'").run();
    assert.throws(() => commitImport(db, admin, { id: old.id }), denied(409));
    expirePreviews(db);
    assert.equal(
      db
        .prepare<[], { n: number }>(
          "SELECT COUNT(*) n FROM cadastur_imports WHERE status='expired' AND payload IS NOT NULL",
        )
        .get()!.n,
      0,
    );
  } finally {
    db.close();
  }
});
test("Cadastur: atualização preserva vínculo e conteúdo operacional, revisão não publica", async () => {
  const { db, admin } = await fixture();
  try {
    const hotel = saveCompany(db, admin, {
      kind: "hotel",
      name: "Nome editado na Hub",
      slug: "teste",
      city: "Manaus",
      description: "Descrição que deve ser preservada.",
      status: "draft",
    });
    const f = await file([line("00123456000199")]);
    commitImport(db, admin, {
      id: createPreview(db, admin, f, options(f), sourceInfo("hospedagens")).id,
    });
    const entry = listDirectory(db, admin, { category: "hospedagens" }).entries[0];
    reviewEntry(db, admin, { id: entry.id, company_id: hotel.id });
    const changed = await file([line("00123456000199", "Nome atualizado na fonte")]);
    const preview = createPreview(
      db,
      admin,
      changed,
      options(changed, "hospedagens", "2026-T3"),
      sourceInfo("hospedagens"),
    );
    assert.equal(preview.counts.updated, 1);
    commitImport(db, admin, { id: preview.id });
    const updated = listDirectory(db, admin, { category: "hospedagens" }).entries[0];
    assert.equal(updated.company_id, hotel.id);
    assert.equal(updated.review_status, "pending");
    const existing = db
      .prepare<string[], { name: string; status: string }>(
        "SELECT name,status FROM companies WHERE id=?",
      )
      .get(hotel.id)!;
    assert.equal(existing.name, "Nome editado na Hub");
    assert.equal(existing.status, "draft");
    const operator = saveCompany(db, admin, {
      kind: "operator",
      name: "Operador de Teste",
      slug: "operador",
      city: "Manaus",
      description: "Operador para teste de vínculo.",
      status: "draft",
    });
    assert.throws(
      () => reviewEntry(db, admin, { id: updated.id, company_id: operator.id }),
      denied(422),
    );
    const guide = saveGuide(db, admin, {
      company_id: operator.id,
      name: "Guia Teste",
      slug: "guia-teste",
      bio: "Guia para teste de vínculo.",
      languages: "Português",
      published: false,
    });
    const guideFile = await file([line("11111111112", "Guia Teste")]);
    commitImport(db, admin, {
      id: createPreview(db, admin, guideFile, options(guideFile, "guias"), sourceInfo("guias")).id,
    });
    const registered = listDirectory(db, admin, { category: "guias" }).entries[0];
    reviewEntry(db, admin, { id: registered.id, guide_id: guide.id });
    assert.equal(listDirectory(db, admin, { category: "guias" }).entries[0].guide_id, guide.id);
  } finally {
    db.close();
  }
});
test("Cadastur: CSV com aspas, BOM e acentos; rejeita arquivo malformado e formatos indevidos", async () => {
  const f = await file([line("00123456000199", '"Pousada; Amazônia"')]);
  assert.equal(f.data[0][1], "Pousada; Amazônia");
  const comma = await parseCadasturFile(
    Buffer.from('\ufeffCertificado,Nome,UF,Município\n00123456000199,"Hotel, Teste",AM,Manaus'),
    "csv",
  );
  assert.equal(comma.data[0][1], "Hotel, Teste");
  await assert.rejects(parseCadasturFile(Buffer.from("data"), "xls"), denied(415));
  await assert.rejects(parseCadasturFile(Buffer.from('A;B;C;D\n"bad'), "csv"), denied(422));
  await assert.rejects(parseCadasturFile(new Uint8Array(20 * 1024 * 1024 + 1), "csv"), denied(413));
  const mapping = suggestMapping([
    "CPF",
    "Número do Certificado",
    "Nome Completo",
    "UF",
    "Município",
  ]);
  assert.equal(mapping.external_id, 1);
});
test("Cadastur: fonte só aceita HTTPS oficial e reconhece trimestres", () => {
  assert.equal(periodFromName("Segundo Trimestre de 2026"), "2026-T2");
  assert.equal(periodFromName("2026 1º trimestre"), "2026-T1");
  assert.equal(periodFromName("2020"), "");
  for (const value of [
    "http://dados.turismo.gov.br/file",
    "https://dados.turismo.gov.br.evil.test/file",
    "http://127.0.0.1/file",
    "https://user:pass@dados.turismo.gov.br/file",
  ])
    assert.throws(() => safeOfficialUrl(value));
  assert.equal(
    safeOfficialUrl("https://dados.turismo.gov.br/dataset/test").hostname,
    "dados.turismo.gov.br",
  );
});
test("Cadastur: XLSX reconhece abas e preserva zeros de identificadores textuais", async () => {
  const bytes = await readFile(new URL("./fixtures/cadastur-ficticio.xlsx", import.meta.url));
  const first = await parseCadasturFile(bytes, "xlsx");
  assert.equal(first.sheets.length, 2);
  assert.equal(first.data[0][0], "00123456000199");
  const guide = await parseCadasturFile(bytes, "xlsx", "Guias PF");
  assert.equal(guide.sheet, "Guias PF");
  assert.equal(guide.mapping.name, 1);
  await assert.rejects(parseCadasturFile(bytes, "xlsx", "Aba inexistente"), denied(422));
  const oversized = Buffer.from(bytes);
  oversized.writeUInt32LE(200 * 1024 * 1024, 22);
  await assert.rejects(parseCadasturFile(oversized, "xlsx"), denied(422));
});
