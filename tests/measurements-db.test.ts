import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { getDatabase, closeDatabase } from "@/server/lib/database";
import { parse_create_measurement, parse_update_measurement } from "@/server/lib/measurement-input";
import * as service from "@/server/services/measurements_service";
import type { RecordAccess } from "@/lib/auth/access-scope";

const url = process.env.DATABASE_URL;
const local = url && ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);

test("local database supports measurement creation, scoped listing, ordered edits, archive and restore", { skip: !local }, async () => {
  const companyId = randomUUID();
  const outsideId = randomUUID();
  const actor = randomUUID();
  const access: RecordAccess = {
    userId: actor, superAdmin: false, companyIds: [companyId], pages: ["measurements"],
    grants: ["view", "add", "edit", "delete"].map((action) => ({ permission: `measurements.${action}`, scope: "company", companyId })),
  };
  const db = getDatabase();
  try {
    await db.company.createMany({ data: [{ id: companyId, name: `Measurement test ${companyId}` }, { id: outsideId, name: `Measurement test ${outsideId}` }] });
    const input = parse_create_measurement({
      company_id: companyId, name: "Dimensions",
      fields: [{ key: "length", label: "Length" }, { key: "width", label: "Width" }, { key: "height", label: "Height" }],
      units: [{ key: "cm", name: "Centimeter", symbol: "cm" }],
    });
    const created = await service.create_measurement(input, access);
    const outsider: RecordAccess = {
      ...access, userId: randomUUID(), companyIds: [outsideId],
      grants: access.grants.map((grant) => ({ ...grant, companyId: outsideId })),
    };
    const outside = await service.create_measurement({ ...input, name: "Outside", company_id: outsideId }, outsider);
    const shared = await service.create_measurement({ ...input, name: "Shared", company_id: companyId }, { ...access, superAdmin: true });
    assert.equal(created.company?.id, companyId);
    assert.equal(created.created_by, actor);
    assert.equal(shared.company_id, null);
    assert.equal(shared.company, null);
    assert.deepEqual(created.fields.map((field) => field.label), ["Length", "Width", "Height"]);
    await assert.rejects(service.get_measurement(outside.id, access), /not found/);
    assert.equal((await service.get_measurement(shared.id, access)).name, "Shared");
    await assert.rejects(service.update_measurement({ id: shared.id, name: "Changed" }, access), /not found/);
    await assert.rejects(service.archive_measurement(shared.id, access), /not found/);
    await assert.rejects(service.create_measurement({ ...input, name: "dimensions" }, access));
    const pagination = { page: 1, page_size: 10, skip: 0, take: 10 };
    const list = await service.list_measurements(pagination, "Dimension", undefined, access);
    assert.equal(list.total, 1);
    assert.equal(list.measurements[0].id, created.id);
    const options = await service.get_measurement_options(access);
    assert.deepEqual(options.companies.map((company) => company.id), [companyId]);
    const edited = await service.update_measurement(parse_update_measurement({
      id: created.id,
      fields: [{ key: "height", label: "Height", position: 0 }, { key: "length", label: "Package length", position: 1 }, { key: "width", label: "Width", position: 2, is_active: false }],
    }), access);
    assert.deepEqual(edited.fields.map((field) => field.key), ["height", "length", "width"]);
    assert.equal(edited.fields.find((field) => field.key === "length")?.id, created.fields[0].id);
    assert.equal(edited.units[0].id, created.units[0].id);
    assert.equal(edited.fields.find((field) => field.key === "width")?.is_active, false);
    await service.archive_measurement(created.id, access);
    assert.equal((await service.list_measurements(pagination, "", undefined, access, companyId, true)).total, 0);
    const archived = await service.get_measurement(created.id, access);
    assert.equal(archived.is_active, false);
    assert.equal(archived.fields.length, 3);
    await service.update_measurement({ id: created.id, is_active: true }, access);
    assert.equal((await service.get_measurement(created.id, access)).is_active, true);
  } finally {
    // Delete only records belonging to the two freshly generated fixture companies.
    await db.$transaction(async (tx) => {
      const owner = { OR: [{ company_id: { in: [companyId, outsideId] } }, { company_id: null, created_by: actor }] };
      await tx.measurement_field.deleteMany({ where: { measurement: owner } });
      await tx.measurement_unit.deleteMany({ where: { measurement: owner } });
      await tx.measurement.deleteMany({ where: owner });
      await tx.company.deleteMany({ where: { id: { in: [companyId, outsideId] } } });
    });
    await closeDatabase();
  }
});
