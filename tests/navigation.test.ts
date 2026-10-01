import assert from "node:assert/strict";
import test from "node:test";
import {
  navigationRoutes,
  navigationPackages,
  navigationSources,
  vesselSchedules,
  type ReferencePrice,
} from "../lib/navigation-data.ts";
import {
  filterNavigationRoutes,
  filterVesselSchedules,
  isHistoricalPrice,
} from "../lib/navigation.ts";

test("navigation filters combine direction and mode without treating the reverse leg as the same trip", () => {
  const outbound = filterNavigationRoutes(navigationRoutes, {
    origin: "Manaus",
    destination: "Maués",
    mode: "fluvial",
  });
  const inbound = filterNavigationRoutes(navigationRoutes, {
    origin: "Maués",
    destination: "Manaus",
    mode: "fluvial",
  });
  assert.equal(outbound.length, 1);
  assert.equal(outbound[0].price?.amountCents, 22000);
  assert.equal(inbound.length, 1);
  assert.equal(
    inbound[0].price,
    null,
    "The Navegam fare must not be applied to the opposite direction",
  );
  assert.equal(
    filterNavigationRoutes(navigationRoutes, {
      origin: "Maués",
      destination: "Maués",
      mode: "todos",
    }).length,
    0,
  );
  assert.equal(
    filterNavigationRoutes(navigationRoutes, {
      origin: "",
      destination: "Boa Vista do Ramos",
      mode: "aereo",
    }).length,
    0,
  );
  assert.equal(
    filterNavigationRoutes(navigationRoutes, { origin: "", destination: "", mode: "todos" }).length,
    navigationRoutes.length,
  );
});

test("regional searches without offers never inherit a numeric fare from Manaus", () => {
  for (const destination of ["Parintins", "Boa Vista do Ramos"]) {
    const rows = filterNavigationRoutes(navigationRoutes, {
      origin: "Maués",
      destination,
      mode: "fluvial",
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].price, null);
    assert.match(rows[0].schedule, /a confirmar/);
  }
});

test("poster transcription preserves both weekly directions and the Friday/Saturday exceptions", () => {
  assert.equal(vesselSchedules.length, 14);
  assert.deepEqual(
    filterVesselSchedules("maues-manaus", "").map((row) => row.time),
    Array(7).fill("12:00"),
  );
  assert.deepEqual(
    filterVesselSchedules("manaus-maues", "").map((row) => row.time),
    ["17:00", "17:00", "17:00", "17:00", "18:00", "12:00", "17:00"],
  );
  assert.equal(filterVesselSchedules("manaus-maues", "4")[0].vessel, "F/B Almirante Dinelson I");
  assert.equal(filterVesselSchedules("manaus-maues", "5")[0].vessel, "F/B Estrela PP III");
  assert.equal(filterVesselSchedules("maues-manaus", "0")[0].operator, "dinelson");
});

test("a passed departure or old undated quote is shown as historical", () => {
  const fare: ReferencePrice = {
    amountCents: 22000,
    unit: "pessoa",
    observedAt: "2026-10-01",
    travelDate: "2026-10-02",
    note: "reference",
  };
  assert.equal(isHistoricalPrice(fare, "2026-10-01"), false);
  assert.equal(isHistoricalPrice(fare, "2026-10-02"), false);
  assert.equal(isHistoricalPrice(fare, "2026-10-03"), true);
  const undated = { ...fare, travelDate: undefined };
  assert.equal(isHistoricalPrice(undated, "2026-10-31"), false);
  assert.equal(isHistoricalPrice(undated, "2026-11-01"), true);
});

test("displayed prices retain positive cent values, evidence and consultation dates", () => {
  for (const route of navigationRoutes) {
    assert.ok(route.sourceIds.length > 0);
    for (const source of route.sourceIds) assert.ok(navigationSources[source].url);
    if (route.price) {
      assert.ok(Number.isSafeInteger(route.price.amountCents) && route.price.amountCents > 0);
      assert.match(route.price.observedAt, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(route.price.travelDate && route.price.note);
    }
  }
  for (const item of navigationPackages) {
    assert.ok(navigationSources[item.sourceId].url.startsWith("https://"));
    assert.ok(item.price.observedAt && item.price.note && item.includes && item.excludes);
  }
});
