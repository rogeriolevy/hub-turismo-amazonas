import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { todayInManaus } from "../lib/platform-schema.ts";
import { verifyCadasturHttp } from "./cadastur-http.ts";
export async function verifyPlatformHttp(
  base: string,
  db: Database.Database,
  email: string,
  password: string,
  oldPassword: string,
) {
  const post = (path: string, body: unknown, cookie = "", extra: Record<string, string> = {}) =>
    fetch(base + path, {
      method: "POST",
      headers: { origin: base, "content-type": "application/json", cookie, ...extra },
      body: JSON.stringify(body),
    });
  const cookieFrom = (response: Response) =>
    response.headers
      .getSetCookie()
      .map((item) => item.split(";")[0])
      .join("; ");
  const data = async (response: Response) => {
    assert.ok(response.ok, `HTTP ${response.status} em operação da plataforma`);
    return (await response.json()).data as { id: string };
  };
  for (const path of ["/hospedagens", "/passeios", "/entrar", "/cadastro"])
    assert.equal((await fetch(base + path)).status, 200);
  for (const path of ["/minha-conta", "/painel/hotel", "/painel/passeios", "/painel/plataforma"]) {
    const response = await fetch(base + path, { redirect: "manual" });
    if (response.status === 307)
      assert.match(response.headers.get("location") || "", /^\/entrar\?voltar=/);
    else {
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.ok(
        html.includes("__next-page-redirect") && html.includes("/entrar?voltar="),
        "Página protegida deve redirecionar, inclusive quando o HTML já começou a ser transmitido.",
      );
    }
  }
  assert.equal((await fetch(base + "/api/plataforma/empresas")).status, 401);
  const touristEmail = "visitor-platform@example.test";
  const account = { name: "Turista de teste", email: touristEmail, password, consent: true };
  assert.equal(
    (await post("/api/conta/cadastro", account, "", { origin: "https://evil.example" })).status,
    403,
  );
  assert.equal((await post("/api/conta/cadastro", { ...account, role: "admin" })).status, 422);
  assert.equal((await post("/api/conta/cadastro", { ...account, email })).status, 403);
  assert.equal((await post("/api/conta/cadastro", account)).status, 200);
  db.prepare("DELETE FROM rateLimit").run(); // Isolated fixture only; the live database is never used here.
  const rootLogin = await post("/api/auth/sign-in/email", { email, password });
  assert.equal(rootLogin.status, 200);
  const root = cookieFrom(rootLogin);
  const visitorLogin = await post("/api/auth/sign-in/email", { email: touristEmail, password });
  assert.equal(visitorLogin.status, 200);
  const visitor = cookieFrom(visitorLogin);
  await verifyCadasturHttp(base, root, visitor);
  const managerLogin = await post("/api/auth/sign-in/email", {
    email: "other@example.test",
    password: oldPassword,
  });
  assert.equal(managerLogin.status, 200);
  const manager = cookieFrom(managerLogin);
  const company = {
    kind: "hotel",
    name: "Pousada de demonstração",
    slug: "pousada-demonstracao",
    city: "Maués",
    description: "Dados fictícios usados somente para testar o catálogo e o fluxo de reservas.",
    status: "published",
  };
  assert.equal((await post("/api/plataforma/empresas", company, visitor)).status, 403);
  const hotel = (await data(await post("/api/plataforma/empresas", company, root))).id;
  const second = (
    await data(
      await post(
        "/api/plataforma/empresas",
        { ...company, name: "Outra empresa de teste", slug: "outra-empresa-teste" },
        root,
      ),
    )
  ).id;
  await data(
    await post(
      "/api/plataforma/acessos",
      { company_id: hotel, email: "other@example.test", role: "hotel_manager" },
      root,
    ),
  );
  assert.equal(
    (
      await fetch(base + "/api/plataforma/inventario?empresa=" + second, {
        headers: { cookie: manager },
      })
    ).status,
    403,
  );
  const room = (
    await data(
      await post(
        "/api/plataforma/quartos",
        {
          company_id: hotel,
          code: "01",
          name: "Quarto de demonstração",
          capacity: 3,
          price_cents: 25000,
          active: true,
        },
        manager,
      ),
    )
  ).id;
  const operator = (
    await data(
      await post(
        "/api/plataforma/empresas",
        {
          ...company,
          kind: "operator",
          name: "Operador de demonstração",
          slug: "operador-demonstracao",
        },
        root,
      ),
    )
  ).id;
  const guide = (
    await data(
      await post(
        "/api/plataforma/guias",
        {
          company_id: operator,
          slug: "guia-demonstracao",
          name: "Guia de demonstração",
          bio: "Perfil inteiramente fictício para validação da plataforma local.",
          languages: "Português",
          published: true,
        },
        root,
      ),
    )
  ).id;
  const tour = (
    await data(
      await post(
        "/api/plataforma/passeios",
        {
          company_id: operator,
          slug: "passeio-demonstracao",
          name: "Caminhos da Amazônia — demonstração",
          description:
            "Experiência fictícia para conferir o catálogo e a aprovação de solicitações.",
          city: "Maués",
          duration_minutes: 120,
          price_cents: 12000,
          guide_id: guide,
          published: true,
        },
        root,
      ),
    )
  ).id;
  const departure = (
    await data(
      await post(
        "/api/plataforma/saidas",
        {
          company_id: operator,
          tour_id: tour,
          starts_at: new Date(Date.now() + 7 * 86400000).toISOString(),
          capacity: 8,
          active: true,
        },
        root,
      ),
    )
  ).id;
  for (const path of [
    "/hospedagens/pousada-demonstracao",
    "/passeios/passeio-demonstracao",
    "/guias/guia-demonstracao",
  ])
    assert.equal((await fetch(base + path)).status, 200);
  const missing = await fetch(base + "/hospedagens/nao-existe");
  if (missing.status === 200) {
    const html = await missing.text();
    assert.ok(html.includes("PÁGINA NÃO ENCONTRADA") && html.includes("noindex"));
  } else assert.equal(missing.status, 404);
  assert.equal((await fetch(base + "/api/catalogo/hospedagens/nao-existe")).status, 404);
  const day = (offset: number) =>
    new Date(Date.parse(todayInManaus() + "T12:00:00Z") + offset * 86400000)
      .toISOString()
      .slice(0, 10);
  const request = {
    kind: "hotel",
    room_id: room,
    check_in: day(1),
    check_out: day(3),
    guests: 2,
    notes: "Solicitação de teste.",
  };
  const key = randomUUID();
  const booking = (
    await data(await post("/api/plataforma/reservas", request, visitor, { "Idempotency-Key": key }))
  ).id;
  assert.equal(
    (
      await data(
        await post("/api/plataforma/reservas", request, visitor, { "Idempotency-Key": key }),
      )
    ).id,
    booking,
  );
  assert.equal(
    (
      await post(
        "/api/plataforma/decisao",
        { company_id: hotel, booking_id: booking, decision: "confirmed" },
        visitor,
      )
    ).status,
    403,
  );
  await data(
    await post(
      "/api/plataforma/decisao",
      { company_id: hotel, booking_id: booking, decision: "confirmed" },
      manager,
    ),
  );
  assert.equal((await post("/api/plataforma/cancelar", { booking_id: booking }, root)).status, 404);
  await data(await post("/api/plataforma/cancelar", { booking_id: booking }, visitor));
  const excursion = (
    await data(
      await post(
        "/api/plataforma/reservas",
        { kind: "tour", departure_id: departure, guests: 2, notes: "" },
        visitor,
        { "Idempotency-Key": randomUUID() },
      ),
    )
  ).id;
  await data(
    await post(
      "/api/plataforma/decisao",
      { company_id: operator, booking_id: excursion, decision: "confirmed" },
      root,
    ),
  );
  const mine = await fetch(base + "/api/plataforma/minhas-reservas", {
    headers: { cookie: visitor },
  });
  assert.equal(mine.status, 200);
  assert.equal((await mine.json()).data.length, 2);
  for (const path of [
    "/minha-conta",
    "/minha-conta/reservas",
    "/painel/plataforma",
    "/painel/plataforma/empresas",
    "/painel/plataforma/acessos",
    "/painel/hotel?empresa=" + hotel,
    "/painel/hotel/quartos?empresa=" + hotel,
    "/painel/hotel/reservas?empresa=" + hotel,
    "/painel/hotel/fnrh?empresa=" + hotel,
    "/painel/passeios?empresa=" + operator,
    "/painel/passeios/guias?empresa=" + operator,
    "/painel/passeios/passeios?empresa=" + operator,
    "/painel/passeios/agenda?empresa=" + operator,
    "/painel/passeios/vagas?empresa=" + operator,
  ])
    assert.equal((await fetch(base + path, { headers: { cookie: root } })).status, 200, path);
  assert.equal(
    (await fetch(base + "/api/admin/contatos", { headers: { cookie: visitor } })).status,
    403,
  );
  assert.equal((await post("/api/plataforma/toString", {}, root)).status, 404);
  await data(
    await post(
      "/api/plataforma/revogar-acesso",
      { company_id: hotel, user_id: (await managerLogin.clone().json()).user.id },
      root,
    ),
  );
  assert.equal(
    (
      await fetch(base + "/api/plataforma/inventario?empresa=" + hotel, {
        headers: { cookie: manager },
      })
    ).status,
    403,
  );
  // Restore only the fixture's manager so the interactive preview can exercise both panels.
  await data(
    await post(
      "/api/plataforma/acessos",
      { company_id: hotel, email: "other@example.test", role: "hotel_manager" },
      root,
    ),
  );
  console.log(
    "PASS: cadastro de turista, rotas, reservas por aprovação, proteção entre empresas, revogação e acesso restrito às mensagens.",
  );
  return { touristEmail, hotelId: hotel, operatorId: operator };
}
