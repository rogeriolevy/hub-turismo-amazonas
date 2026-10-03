import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { openDatabase } from "../db/index.ts";
import { migrateDatabase } from "../db/migrate-auth.ts";
import {
  saveCompany,
  saveMember,
  removeMember,
  saveRoom,
  saveTour,
  saveGuide,
  saveDeparture,
  companyInventory,
  listMembers,
} from "../server/company-service.ts";
import { companiesFor, companyAccess } from "../server/platform-access.ts";
import {
  requestBooking,
  decideBooking,
  cancelBooking,
  myBookings,
  businessBookings,
  recordStay,
} from "../server/booking-service.ts";
import {
  publicHotels,
  publicHotel,
  publicTours,
  publicTour,
  publicGuide,
} from "../server/catalog-service.ts";
import { todayInManaus, companyDisplayName, registrationSchema } from "../lib/platform-schema.ts";
import { normalizeBrazilianMobile } from "../lib/br-mobile.ts";
import { HttpError } from "../server/http.ts";
process.env.SITE_URL = "http://127.0.0.1:3100";
process.env.BETTER_AUTH_SECRET = randomBytes(48).toString("base64url");
process.env.ADMIN_EMAILS = "admin@example.test";
const day = (offset: number) =>
  new Date(Date.parse(todayInManaus() + "T12:00:00Z") + offset * 86400000)
    .toISOString()
    .slice(0, 10);
const denied = (status: number) => (error: unknown) =>
  error instanceof HttpError && error.status === status;
async function fixture() {
  const db = openDatabase(":memory:");
  await migrateDatabase(db);
  const user = (email: string) => {
    const actor = { id: randomUUID(), email, name: "Pessoa de teste" };
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO "user" (id,name,email,emailVerified,createdAt,updatedAt) VALUES (?,?,?,0,?,?)',
    ).run(actor.id, actor.name, actor.email, now, now);
    return actor;
  };
  const root = user("admin@example.test"),
    manager = user("manager@example.test"),
    outsider = user("outsider@example.test"),
    tourist = user("tourist@example.test");
  const hotel = saveCompany(db, root, {
    kind: "hotel",
    name: "Hotel de teste",
    slug: "hotel-teste",
    city: "Maués",
    description: "Empresa fictícia para testes automatizados.",
    status: "published",
  }).id;
  const otherHotel = saveCompany(db, root, {
    kind: "hotel",
    name: "Outro hotel de teste",
    slug: "outro-hotel",
    city: "Manaus",
    description: "Outra empresa fictícia para testes automatizados.",
    status: "published",
  }).id;
  const operator = saveCompany(db, root, {
    kind: "operator",
    name: "Operador de teste",
    slug: "operador-teste",
    city: "Maués",
    description: "Operador fictício para testes automatizados.",
    status: "published",
  }).id;
  saveMember(db, root, { company_id: hotel, email: manager.email, role: "hotel_manager" });
  const room = saveRoom(db, manager, {
    company_id: hotel,
    code: "01",
    name: "Quarto de teste",
    capacity: 2,
    price_cents: 25000,
    active: true,
  }).id;
  const tour = saveTour(db, root, {
    company_id: operator,
    slug: "passeio-teste",
    name: "Passeio de teste",
    description: "Experiência fictícia para teste de capacidade.",
    city: "Maués",
    duration_minutes: 120,
    price_cents: 10000,
    guide_id: "",
    published: true,
  }).id;
  const departure = saveDeparture(db, root, {
    company_id: operator,
    tour_id: tour,
    starts_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    capacity: 2,
    active: true,
  }).id;
  const hotelRequest = {
    kind: "hotel",
    room_id: room,
    check_in: day(1),
    check_out: day(3),
    guests: 2,
    notes: "",
  };
  return {
    db,
    root,
    manager,
    outsider,
    tourist,
    hotel,
    otherHotel,
    operator,
    room,
    tour,
    departure,
    hotelRequest,
  };
}
test("company activity classifies lodging, river navigation and air transport", async () => {
  const f = await fixture();
  try {
    const navigation = saveCompany(f.db, f.root, {
      kind: "operator",
      activity_type: "navegacao_fluvial",
      name: "Navegação de teste",
      slug: "navegacao-classificada",
      city: "Maués",
      description: "Empresa fictícia de navegação fluvial para teste.",
      status: "draft",
    }).id;
    const airTransport = saveCompany(f.db, f.root, {
      kind: "operator",
      activity_type: "transporte_aereo",
      name: "Transporte aéreo de teste",
      slug: "transporte-aereo-classificado",
      city: "Manaus",
      description: "Empresa fictícia de transporte aéreo para teste.",
      status: "draft",
    }).id;
    assert.equal(
      f.db
        .prepare<[string], { activity_type: string }>(
          "SELECT activity_type FROM companies WHERE id=?",
        )
        .get(navigation)?.activity_type,
      "navegacao_fluvial",
    );
    assert.equal(
      f.db
        .prepare<[string], { activity_type: string }>(
          "SELECT activity_type FROM companies WHERE id=?",
        )
        .get(airTransport)?.activity_type,
      "transporte_aereo",
    );
    assert.equal(publicHotel(f.db, "hotel-teste")?.activity_type, "hotel");
    assert.throws(
      () =>
        saveCompany(f.db, f.root, {
          kind: "hotel",
          activity_type: "transporte_aereo",
          name: "Tipo incompatível",
          slug: "atividade-incompativel",
          city: "Manaus",
          description: "Empresa fictícia para validar a compatibilidade do tipo.",
          status: "draft",
        }),
      denied(422),
    );
  } finally {
    f.db.close();
  }
});
test("registration normalizes Brazilian mobiles and rejects malformed or obvious placeholders", () => {
  assert.equal(normalizeBrazilianMobile("(92) 99123-4567"), "+5592991234567");
  assert.equal(normalizeBrazilianMobile("+55 92 99123-4567"), "+5592991234567");
  assert.equal(normalizeBrazilianMobile("(00) 99999-9999"), null);
  assert.equal(normalizeBrazilianMobile("(92) 99999-9999"), null);
  assert.equal(normalizeBrazilianMobile("(92) 12345-6789"), null);
  const input = {
    name: "Pessoa de teste",
    email: "pessoa@example.test",
    phoneNumber: "(92) 99123-4567",
    password: "Senha-forte-2026!",
    consent: true,
  };
  assert.equal(registrationSchema.parse(input).phoneNumber, "+5592991234567");
  assert.equal(
    registrationSchema.safeParse({ ...input, phoneNumber: "99999999999" }).success,
    false,
  );
});
test("companies use trade names in listings, searches and bookings without losing registered names", async () => {
  const f = await fixture();
  try {
    const input = {
      id: f.hotel,
      kind: "hotel",
      name: "Z Empresa Legal Ltda",
      slug: "hotel-teste",
      city: "Maués",
      description: "Empresa fictícia para testes automatizados.",
      status: "published",
    };
    saveCompany(f.db, f.root, { ...input, trade_name: "  A Pousada do Rio  " });
    const found = publicHotels(f.db, "Pousada do Rio");
    assert.equal(found.length, 1);
    assert.equal(found[0].name, "Z Empresa Legal Ltda");
    assert.equal(found[0].trade_name, "A Pousada do Rio");
    assert.equal(companyDisplayName(found[0]), "A Pousada do Rio");
    assert.equal(publicHotels(f.db, "Empresa Legal")[0].id, f.hotel);
    assert.equal(publicHotels(f.db)[0].id, f.hotel);
    assert.equal(companiesFor(f.db, f.root)[0].id, f.hotel);
    assert.equal(companyDisplayName(companiesFor(f.db, f.manager)[0]), "A Pousada do Rio");
    assert.equal(companyDisplayName(publicHotel(f.db, "hotel-teste")!), "A Pousada do Rio");
    assert.equal(listMembers(f.db, f.root)[0].company_name, "A Pousada do Rio");
    requestBooking(f.db, f.tourist, f.hotelRequest, randomUUID());
    assert.equal(myBookings(f.db, f.tourist)[0].company_name, "A Pousada do Rio");
    assert.equal(businessBookings(f.db, f.manager, f.hotel)[0].company_name, "A Pousada do Rio");
    saveCompany(f.db, f.root, {
      ...input,
      description: "Descrição alterada por cliente sem campo fantasia.",
    });
    assert.equal(publicHotel(f.db, "hotel-teste")!.trade_name, "A Pousada do Rio");
    assert.throws(() => saveCompany(f.db, f.root, { ...input, trade_name: "x" }), denied(422));
    assert.throws(
      () => saveCompany(f.db, f.root, { ...input, trade_name: "x".repeat(101) }),
      denied(422),
    );
    saveCompany(f.db, f.root, { ...input, trade_name: " " });
    assert.equal(companyDisplayName(publicHotel(f.db, "hotel-teste")!), input.name);
    assert.equal(myBookings(f.db, f.tourist)[0].company_name, input.name);

    saveCompany(f.db, f.root, {
      id: f.operator,
      kind: "operator",
      name: "Operador de teste",
      trade_name: "Rios da Amazônia",
      slug: "operador-teste",
      city: "Maués",
      description: "Operador fictício para testar nome fantasia.",
      status: "published",
    });
    assert.equal(publicTours(f.db)[0].company_name, "Rios da Amazônia");
    assert.equal(publicTour(f.db, "passeio-teste")!.company_name, "Rios da Amazônia");
    saveGuide(f.db, f.root, {
      company_id: f.operator,
      slug: "guia-fantasia",
      name: "Guia de Teste",
      bio: "Guia fictício para verificar a empresa.",
      languages: "Português",
      published: true,
    });
    assert.equal(publicGuide(f.db, "guia-fantasia")!.company_name, "Rios da Amazônia");
  } finally {
    f.db.close();
  }
});

test("tenant permissions are isolated, role grants are admin-only, and revocation is immediate", async () => {
  const f = await fixture();
  try {
    assert.equal(companiesFor(f.db, f.tourist).length, 0);
    assert.equal(companiesFor(f.db, f.manager).length, 1);
    assert.throws(() => companyInventory(f.db, f.manager, f.otherHotel), denied(403));
    assert.throws(
      () =>
        saveCompany(f.db, f.manager, {
          kind: "hotel",
          name: "Ataque",
          slug: "ataque",
          city: "Manaus",
          description: "Empresa não autorizada para este teste.",
          status: "published",
        }),
      denied(403),
    );
    assert.throws(
      () =>
        saveMember(f.db, f.manager, {
          company_id: f.hotel,
          email: f.outsider.email,
          role: "hotel_manager",
        }),
      denied(403),
    );
    assert.throws(
      () =>
        saveMember(f.db, f.root, {
          company_id: f.hotel,
          email: f.outsider.email,
          role: "operator",
        }),
      denied(422),
    );
    removeMember(f.db, f.root, f.hotel, f.manager.id);
    assert.throws(() => companyAccess(f.db, f.manager, f.hotel), denied(403));
  } finally {
    f.db.close();
  }
});
test("resource identifiers cannot move inventory between tenants", async () => {
  const f = await fixture();
  try {
    const foreign = saveRoom(f.db, f.root, {
      company_id: f.otherHotel,
      code: "02",
      name: "Quarto de outra empresa",
      capacity: 2,
      price_cents: 30000,
      active: true,
    }).id;
    assert.throws(
      () =>
        saveRoom(f.db, f.manager, {
          id: foreign,
          company_id: f.hotel,
          code: "02",
          name: "Alteração proibida",
          capacity: 2,
          price_cents: 1,
          active: true,
        }),
      denied(404),
    );
    const guide = saveGuide(f.db, f.root, {
      company_id: f.operator,
      slug: "guia-teste",
      name: "Guia fictício",
      bio: "Perfil fictício para testes da plataforma.",
      languages: "Português",
      published: true,
    }).id;
    const other = saveCompany(f.db, f.root, {
      kind: "operator",
      name: "Outro operador",
      slug: "outro-operador",
      city: "Manaus",
      description: "Empresa fictícia para isolar passeios e guias.",
      status: "published",
    }).id;
    assert.throws(
      () =>
        saveTour(f.db, f.root, {
          company_id: other,
          slug: "teste-falho",
          name: "Teste falho",
          description: "Passeio para testar vínculo de guia entre empresas.",
          city: "Manaus",
          duration_minutes: 60,
          price_cents: 5000,
          guide_id: guide,
          published: true,
        }),
      denied(404),
    );
  } finally {
    f.db.close();
  }
});
test("pending requests do not block rooms, but conflicting approvals are refused atomically", async () => {
  const f = await fixture();
  try {
    const a = requestBooking(f.db, f.tourist, f.hotelRequest, randomUUID()).id,
      b = requestBooking(f.db, f.outsider, f.hotelRequest, randomUUID()).id;
    decideBooking(f.db, f.manager, { company_id: f.hotel, booking_id: a, decision: "confirmed" });
    assert.throws(
      () =>
        decideBooking(f.db, f.manager, {
          company_id: f.hotel,
          booking_id: b,
          decision: "confirmed",
        }),
      denied(409),
    );
    assert.equal(myBookings(f.db, f.outsider)[0].status, "pending");
    assert.equal(myBookings(f.db, f.tourist)[0].total_cents, 50000);
    const adjacent = requestBooking(
      f.db,
      f.tourist,
      { ...f.hotelRequest, check_in: day(3), check_out: day(4) },
      randomUUID(),
    ).id;
    decideBooking(f.db, f.manager, {
      company_id: f.hotel,
      booking_id: adjacent,
      decision: "confirmed",
    });
    assert.throws(
      () =>
        saveRoom(f.db, f.manager, {
          id: f.room,
          company_id: f.hotel,
          code: "01",
          name: "Quarto de teste",
          capacity: 1,
          price_cents: 25000,
          active: true,
        }),
      denied(409),
    );
  } finally {
    f.db.close();
  }
});
test("tour approvals enforce capacity and cancellation releases seats", async () => {
  const f = await fixture();
  try {
    const input = { kind: "tour", departure_id: f.departure, guests: 2, notes: "" };
    const first = requestBooking(f.db, f.tourist, input, randomUUID()).id,
      second = requestBooking(f.db, f.outsider, { ...input, guests: 1 }, randomUUID()).id;
    decideBooking(f.db, f.root, {
      company_id: f.operator,
      booking_id: first,
      decision: "confirmed",
    });
    assert.throws(
      () =>
        decideBooking(f.db, f.root, {
          company_id: f.operator,
          booking_id: second,
          decision: "confirmed",
        }),
      denied(409),
    );
    assert.throws(() => cancelBooking(f.db, f.outsider, first), denied(404));
    cancelBooking(f.db, f.tourist, first);
    decideBooking(f.db, f.root, {
      company_id: f.operator,
      booking_id: second,
      decision: "confirmed",
    });
    assert.equal(myBookings(f.db, f.outsider)[0].status, "confirmed");
    const old = companyInventory(f.db, f.root, f.operator).departures[0];
    assert.throws(
      () =>
        saveDeparture(f.db, f.root, {
          id: f.departure,
          company_id: f.operator,
          tour_id: f.tour,
          starts_at: new Date(Date.parse(old.starts_at) + 86400000).toISOString(),
          capacity: 2,
          active: true,
        }),
      denied(409),
    );
  } finally {
    f.db.close();
  }
});
test("requests validate dates, capacity, idempotency and personal data ownership", async () => {
  const f = await fixture();
  try {
    const key = randomUUID(),
      first = requestBooking(f.db, f.tourist, f.hotelRequest, key);
    assert.equal(requestBooking(f.db, f.tourist, f.hotelRequest, key).id, first.id);
    assert.throws(
      () => requestBooking(f.db, f.tourist, { ...f.hotelRequest, guests: 1 }, key),
      denied(409),
    );
    for (const patch of [
      { check_in: "2026-02-30" },
      { check_out: day(1) },
      { check_in: day(-1) },
      { guests: 3 },
      { status: "confirmed" },
      { user_id: f.root.id },
    ])
      assert.throws(
        () => requestBooking(f.db, f.tourist, { ...f.hotelRequest, ...patch }, randomUUID()),
        denied(422),
      );
    assert.equal(myBookings(f.db, f.outsider).length, 0);
    assert.throws(() => businessBookings(f.db, f.outsider, f.hotel), denied(403));
    assert.throws(
      () =>
        decideBooking(f.db, f.manager, {
          company_id: f.otherHotel,
          booking_id: first.id,
          decision: "confirmed",
        }),
      denied(403),
    );
  } finally {
    f.db.close();
  }
});
test("unpublished and suspended companies do not leak catalog entries or accept requests", async () => {
  const f = await fixture();
  try {
    assert.equal(publicHotels(f.db).length, 2);
    assert.equal(publicTours(f.db).length, 1);
    saveCompany(f.db, f.root, {
      id: f.hotel,
      kind: "hotel",
      name: "Hotel de teste",
      slug: "hotel-teste",
      city: "Maués",
      description: "Empresa fictícia para testes automatizados.",
      status: "suspended",
    });
    assert.equal(publicHotels(f.db).length, 1);
    assert.throws(() => companyAccess(f.db, f.manager, f.hotel), denied(403));
    assert.throws(() => requestBooking(f.db, f.tourist, f.hotelRequest, randomUUID()), denied(404));
    assert.equal(publicGuide(f.db, "inexistente"), null);
  } finally {
    f.db.close();
  }
});
test("local stay records require confirmed reservations and enforce check-in/out order", async () => {
  const f = await fixture();
  try {
    const booking = requestBooking(
      f.db,
      f.tourist,
      { ...f.hotelRequest, check_in: day(0), check_out: day(2) },
      randomUUID(),
    ).id;
    const input = {
      company_id: f.hotel,
      booking_id: booking,
      action: "checkin",
      country: "Brasil",
      origin_city: "Manaus",
    };
    assert.throws(() => recordStay(f.db, f.manager, input), denied(409));
    decideBooking(f.db, f.manager, {
      company_id: f.hotel,
      booking_id: booking,
      decision: "confirmed",
    });
    assert.throws(() => recordStay(f.db, f.manager, { ...input, action: "checkout" }), denied(409));
    recordStay(f.db, f.manager, input);
    assert.throws(() => recordStay(f.db, f.manager, input), denied(409));
    assert.throws(() => cancelBooking(f.db, f.tourist, booking), denied(409));
    recordStay(f.db, f.manager, { ...input, action: "checkout" });
    assert.ok(businessBookings(f.db, f.manager, f.hotel)[0].checked_out_at);
  } finally {
    f.db.close();
  }
});
