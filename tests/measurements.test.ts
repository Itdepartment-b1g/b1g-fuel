import assert from "node:assert/strict";
import { test } from "node:test";
import { can_create_measurement, delete_measurement, get_measurement_options, measurement_company, update_measurement } from "@/server/services/measurements_service";
import { canPerform, type RecordAccess } from "@/lib/auth/access-scope";
import { record_where } from "@/server/auth/record-access";
import { openapi } from "@/lib/openapi/openapi";
import * as repository from "@/server/repositories/measurements_repository";
import type { Database } from "@/server/lib/database";

const company = "30000000-0000-4000-8000-000000000001";
const input = {
  company_id: company, name: "Dimensions",
  units: [{ key: "cm", name: "Centimeter", symbol: "cm" }, { key: "m", name: "Meter", symbol: "m" }],
};
const access: RecordAccess = {
  userId: "creator", superAdmin: false, companyIds: [company], pages: ["measurements"],
  grants: [{ permission: "measurements.add", scope: "company", companyId: company }, { permission: "measurements.view", scope: "company", companyId: company }],
};

test("creation grants and record filtering isolate company catalogs", () => {
  assert.equal(can_create_measurement(access, company), true);
  assert.equal(can_create_measurement(access, "another-company"), false);
  assert.deepEqual(record_where(access, "measurements"), { OR: [{ company_id: { in: [company] } }, { company_id: null }] });
  assert.equal(canPerform(access, "measurements", "view", { id: "id", company_id: "another-company", created_by: null }), false);
  assert.equal(measurement_company(access, "another-company"), company);
  assert.equal(measurement_company({ ...access, superAdmin: true }, company), null);
  const several = { ...access, companyIds: [company, "another-company"], grants: [company, "another-company"].map((companyId) => ({ permission: "measurements.add", scope: "company" as const, companyId })) };
  assert.equal(measurement_company(several, "another-company"), "another-company");
  assert.throws(() => measurement_company(several), /Select a company/);
  const sharedEditor = { ...access, grants: [{ permission: "measurements.edit", scope: "all" as const, companyId: null }] };
  assert.equal(canPerform(sharedEditor, "measurements", "edit", { id: "id", company_id: null, created_by: "admin" }), false);
  assert.deepEqual(record_where(sharedEditor, "measurements", "edit"), { company_id: { not: null } });
  assert.equal(canPerform({ ...sharedEditor, superAdmin: true }, "measurements", "edit", { id: "id", company_id: null, created_by: "admin" }), true);
  const own = { ...access, grants: [{ permission: "measurements.edit", scope: "own" as const, companyId: company }] };
  assert.deepEqual(record_where(own, "measurements", "edit"), { OR: [{ created_by: "creator" }] });
  assert.deepEqual(record_where(own, "measurements", "delete"), { OR: [] });
  const all = { ...access, companyIds: [], grants: [{ permission: "measurements.add", scope: "all" as const, companyId: null }] };
  assert.equal(can_create_measurement(all, "another-company"), true);
  assert.equal(can_create_measurement({ ...access, grants: [] }, company), false);
});
test("measurement endpoints are documented in the API schema", () => {
  assert.ok(openapi.paths["/api/measurements"]);
  assert.ok(openapi.components.schemas.CreateMeasurement);
});

test("child updates preserve existing IDs and omitted definitions; invalid updates write nothing", async () => {
  const parsed = input;
  const current = {
    id: company, company_id: company, created_by: access.userId, name: parsed.name,
    created_at: new Date("2026-10-14T00:00:00Z"), updated_at: new Date("2026-10-14T00:00:00Z"),
    units: parsed.units.map((unit) => ({ ...unit, id: `unit-${unit.key}`, measurement_id: company })),
  };
  let writes = 0;
  const tx = {
    measurement: {
      findFirst: async (args: { where: unknown }) => {
        assert.deepEqual(args.where, { AND: [{ id: company }, { OR: [{ created_by: "creator" }] }] });
        return current;
      },
      update: async () => { writes++; return current; },
    },
    user: { findMany: async () => [{ id: access.userId, name: "Creator" }] },
    measurement_unit: {
      upsert: async (args: { update: typeof parsed.units[number] }) => {
        writes++;
        const existing = current.units.find((unit) => unit.key === args.update.key);
        assert.ok(existing);
        Object.assign(existing, args.update);
      },
    },
  };
  const state = globalThis as typeof globalThis & { fuelDatabase?: { database: Database } };
  const previous = state.fuelDatabase;
  state.fuelDatabase = { database: { $transaction: async (run: (client: typeof tx) => unknown) => run(tx) } as unknown as Database };
  const own = { ...access, grants: [{ permission: "measurements.edit", scope: "own" as const, companyId: company }] };
  try {
    const result = await repository.update_measurement({ id: company, units: [{ key: "cm", name: "Centimetre", symbol: "cm" }] }, own);
    if (typeof result === "string") assert.fail(result);
    assert.equal(result.units[0].id, "unit-cm");
    assert.equal(result.units[0].name, "Centimetre");
    assert.equal(result.units[1].id, "unit-m");
    const priorWrites = writes;
    await assert.rejects(update_measurement({
      id: company, units: [{ key: "other", name: "Other", symbol: "CM" }],
    }, own), /symbols must be unique/);
    assert.equal(writes, priorWrites);
  } finally { state.fuelDatabase = previous; }
});

test("creation persists the authenticated actor and all nested definitions atomically", async () => {
  const parsed = input;
  const state = globalThis as typeof globalThis & { fuelDatabase?: { database: Database } };
  const previous = state.fuelDatabase;
  state.fuelDatabase = { database: {
    measurement: { create: async (args: { data: { created_by: string; units: { create: unknown } } }) => {
      assert.equal(args.data.created_by, access.userId);
      assert.deepEqual(args.data.units.create, parsed.units);
      return { id: company, company_id: company, created_by: access.userId, name: parsed.name,
        created_at: new Date(), updated_at: new Date(), units: [] };
    } },
    user: { findMany: async () => [{ id: access.userId, name: "Creator" }] },
  } as unknown as Database };
  try {
    const created = await repository.create_measurement(parsed, access.userId);
    assert.equal(created.created_by_name, "Creator");
  }
  finally { state.fuelDatabase = previous; }
});

test("delete removes units before the measurement and skips inaccessible definitions", async () => {
  const state = globalThis as typeof globalThis & { fuelDatabase?: { database: Database } };
  const previous = state.fuelDatabase;
  const denied = {
    measurement: { findFirst: async (args: { where: unknown }) => {
      assert.deepEqual(args.where, { AND: [{ id: company }, { OR: [] }] });
      return null;
    }, delete: async () => { assert.fail("Unauthorized mutation must not run"); } },
    measurement_unit: { deleteMany: async () => { assert.fail("Unauthorized mutation must not run"); } },
  };
  const order: string[] = [];
  const allowed = {
    measurement: {
      findFirst: async () => ({ id: company }),
      delete: async (args: { where: { id: string } }) => { order.push("measurement"); assert.equal(args.where.id, company); },
    },
    measurement_unit: { deleteMany: async (args: { where: { measurement_id: string } }) => {
      order.push("units");
      assert.equal(args.where.measurement_id, company);
    } },
  };
  const deleter = { ...access, grants: [{ permission: "measurements.delete", scope: "company" as const, companyId: company }] };
  try {
    state.fuelDatabase = { database: { $transaction: async (run: (client: typeof denied) => unknown) => run(denied) } as unknown as Database };
    await assert.rejects(delete_measurement(company, access), /Measurement not found/);
    state.fuelDatabase = { database: { $transaction: async (run: (client: typeof allowed) => unknown) => run(allowed) } as unknown as Database };
    await repository.delete_measurement(company, deleter);
    assert.deepEqual(order, ["units", "measurement"]);
  } finally { state.fuelDatabase = previous; }
});

test("company options use measurement creation grants without requiring companies.view", async () => {
  const state = globalThis as typeof globalThis & { fuelDatabase?: { database: Database } };
  const previous = state.fuelDatabase;
  const filters: unknown[] = [];
  state.fuelDatabase = { database: { company: { findMany: async (args: { where: unknown }) => {
    filters.push(args.where);
    return [{ id: company, name: "B1G Fuel" }];
  } } } as unknown as Database };
  try {
    const options = await get_measurement_options(access);
    assert.equal(options.companies[0].name, "B1G Fuel");
    await get_measurement_options({ ...access, grants: [] });
    await get_measurement_options({ ...access, superAdmin: true });
    assert.deepEqual(filters, [{ id: { in: [company] } }, { id: { in: [] } }, {}]);
  } finally { state.fuelDatabase = previous; }
});
