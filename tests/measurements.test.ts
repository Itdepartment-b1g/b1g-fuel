import assert from "node:assert/strict";
import { test } from "node:test";
import { parse_create_measurement, parse_update_measurement } from "@/server/lib/measurement-input";
import { can_create_measurement } from "@/server/services/measurements_service";
import { canPerform, type RecordAccess } from "@/lib/auth/access-scope";
import { record_where } from "@/server/auth/record-access";
import { create_measurement } from "@/server/controllers/measurements_controller";
import type { Request, Response } from "express";
import { openapi } from "@/lib/openapi";
import * as repository from "@/server/repositories/measurements_repository";
import type { Database } from "@/server/lib/database";

const company = "30000000-0000-4000-8000-000000000001";
const input = {
  company_id: company, name: " Dimensions ",
  fields: [{ key: "length", label: "Length" }, { key: "width", label: "Width" }, { key: "height", label: "Height" }],
  units: [{ key: "cm", name: "Centimeter", symbol: "cm" }],
};
const access: RecordAccess = {
  userId: "creator", superAdmin: false, companyIds: [company], pages: ["measurements"],
  grants: [{ permission: "measurements.add", scope: "company", companyId: company }, { permission: "measurements.view", scope: "company", companyId: company }],
};

test("dynamic measurement definitions normalize names and preserve field order", () => {
  const result = parse_create_measurement(input);
  assert.equal(result.name, "Dimensions");
  assert.deepEqual(result.fields.map((field) => [field.key, field.position, field.required]), [["length", 0, true], ["width", 1, true], ["height", 2, true]]);
  assert.equal(result.units[0].is_active, true);
});
test("invalid definitions reject duplicate keys, symbols, empty groups and client-controlled ownership metadata", () => {
  for (const invalid of [
    { ...input, created_by: "someone" },
    { ...input, fields: [] },
    { ...input, fields: [input.fields[0], input.fields[0]] },
    { ...input, fields: [{ key: "Length", label: "Length" }] },
    { ...input, fields: [{ key: "length", label: "Length", required: "yes" }] },
    { ...input, fields: [{ key: "length", label: "Length", position: -1 }] },
    { ...input, units: [{ key: "cm", name: "Centimeter", symbol: "cm" }, { key: "other", name: "Other", symbol: "CM" }] },
    { ...input, units: [{ ...input.units[0], is_active: false }] },
    { ...input, units: Array.from({ length: 31 }, (_, index) => ({ key: `u${index}`, name: "Unit", symbol: `u${index}` })) },
  ]) assert.throws(() => parse_create_measurement(invalid));
});
test("updates cannot move measurements between companies and accept deactivation by stable key", () => {
  assert.throws(() => parse_update_measurement({ id: company, company_id: company }));
  assert.throws(() => parse_update_measurement({ id: company }));
  const result = parse_update_measurement({ id: company, fields: [{ key: "length", label: "Length", is_active: false }] });
  assert.equal(result.fields?.[0].is_active, false);
  assert.equal(result.units, undefined);
});
test("creation grants and record filtering isolate company catalogs", () => {
  assert.equal(can_create_measurement(access, company), true);
  assert.equal(can_create_measurement(access, "another-company"), false);
  assert.deepEqual(record_where(access, "measurements"), { OR: [{ company_id: { in: [company] } }] });
  assert.equal(canPerform(access, "measurements", "view", { id: "id", company_id: "another-company", created_by: null }), false);
  const own = { ...access, grants: [{ permission: "measurements.edit", scope: "own" as const, companyId: company }] };
  assert.deepEqual(record_where(own, "measurements", "edit"), { OR: [{ created_by: "creator" }] });
  assert.deepEqual(record_where(own, "measurements", "delete"), { OR: [] });
  const all = { ...access, companyIds: [], grants: [{ permission: "measurements.add", scope: "all" as const, companyId: null }] };
  assert.equal(can_create_measurement(all, "another-company"), true);
  assert.equal(can_create_measurement({ ...access, grants: [] }, company), false);
});
test("create endpoint rejects spoofed creator without touching the database", async () => {
  let status = 0;
  const res = { locals: { access }, status(value: number) { status = value; return res; }, json() { return res; } } as unknown as Response;
  await create_measurement({ body: { ...input, created_by: "someone" } } as Request, res);
  assert.equal(status, 400);
});
test("measurement endpoints are documented in the API schema", () => {
  assert.ok(openapi.paths["/api/measurements"]);
  assert.ok(openapi.components.schemas.CreateMeasurement);
});

test("child updates preserve existing IDs and omitted definitions; invalid updates write nothing", async () => {
  const parsed = parse_create_measurement(input);
  const current = {
    id: company, company_id: company, created_by: access.userId, name: parsed.name, is_active: true,
    created_at: new Date("2026-10-14T00:00:00Z"), updated_at: new Date("2026-10-14T00:00:00Z"),
    fields: parsed.fields.map((field) => ({ ...field, id: `field-${field.key}`, measurement_id: company })),
    units: parsed.units.map((unit) => ({ ...unit, id: `unit-${unit.key}`, measurement_id: company })),
  };
  let locked = false;
  let writes = 0;
  const tx = {
    $queryRaw: async () => { locked = true; },
    measurement: {
      findFirst: async (args: { where: unknown }) => {
        assert.ok(locked);
        assert.deepEqual(args.where, { AND: [{ id: company }, { OR: [{ created_by: "creator" }] }] });
        return current;
      },
      update: async () => { writes++; return current; },
    },
    measurement_field: {
      upsert: async (args: { update: typeof parsed.fields[number] }) => {
        writes++;
        const existing = current.fields.find((field) => field.key === args.update.key);
        assert.ok(existing);
        Object.assign(existing, args.update);
      },
    },
    measurement_unit: { upsert: async () => { writes++; } },
  };
  const state = globalThis as typeof globalThis & { fuelDatabase?: { database: Database } };
  const previous = state.fuelDatabase;
  state.fuelDatabase = { database: { $transaction: async (run: (client: typeof tx) => unknown) => run(tx) } as unknown as Database };
  const own = { ...access, grants: [{ permission: "measurements.edit", scope: "own" as const, companyId: company }] };
  try {
    const result = await repository.update_measurement(parse_update_measurement({ id: company, fields: [{ key: "length", label: "Package length" }] }), own);
    assert.equal(result.fields[0].id, "field-length");
    assert.equal(result.fields[0].label, "Package length");
    assert.deepEqual(result.fields.slice(1).map((field) => field.key), ["width", "height"]);
    assert.equal(result.units[0].id, "unit-cm");
    const priorWrites = writes;
    await assert.rejects(repository.update_measurement(parse_update_measurement({
      id: company, fields: parsed.fields.map((field) => ({ ...field, is_active: false })),
    }), own), /at least one active field/);
    await assert.rejects(repository.update_measurement(parse_update_measurement({
      id: company, units: [{ key: "other", name: "Other", symbol: "CM" }],
    }), own), /symbols must be unique/);
    assert.equal(writes, priorWrites);
  } finally { state.fuelDatabase = previous; }
});

test("creation persists the authenticated actor and all nested definitions atomically", async () => {
  const parsed = parse_create_measurement(input);
  const state = globalThis as typeof globalThis & { fuelDatabase?: { database: Database } };
  const previous = state.fuelDatabase;
  state.fuelDatabase = { database: {
    measurement: { create: async (args: { data: { created_by: string; fields: { create: unknown }; units: { create: unknown } } }) => {
      assert.equal(args.data.created_by, access.userId);
      assert.deepEqual(args.data.fields.create, parsed.fields);
      assert.deepEqual(args.data.units.create, parsed.units);
      return { id: company, company_id: company, created_by: access.userId, name: parsed.name, is_active: true,
        created_at: new Date(), updated_at: new Date(), fields: [], units: [] };
    } },
  } as unknown as Database };
  try { await repository.create_measurement(parsed, access.userId); }
  finally { state.fuelDatabase = previous; }
});

test("archive checks delete scope and returns not found without mutating inaccessible definitions", async () => {
  const state = globalThis as typeof globalThis & { fuelDatabase?: { database: Database } };
  const previous = state.fuelDatabase;
  const tx = {
    $queryRaw: async () => [],
    measurement: { findFirst: async (args: { where: unknown }) => {
      assert.deepEqual(args.where, { AND: [{ id: company }, { OR: [] }] });
      return null;
    }, update: async () => { assert.fail("Unauthorized mutation must not run"); } },
  };
  state.fuelDatabase = { database: { $transaction: async (run: (client: typeof tx) => unknown) => run(tx) } as unknown as Database };
  try {
    await assert.rejects(repository.update_measurement({ id: company, is_active: false }, access, "delete"), /Measurement not found/);
  } finally { state.fuelDatabase = previous; }
});
