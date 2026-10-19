import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { closeDatabase, getDatabase, type Database } from "@/server/lib/database";
import type { RecordAccess } from "@/lib/auth/access-scope";
import * as service from "@/server/services/material_requests_service";
import { allocate_request_number } from "@/server/repositories/material_requests_repository";
import { update_company } from "@/server/services/companies_service";

const url = process.env.DATABASE_URL;
const local = url && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(url).hostname);
const pagination = { page: 1, page_size: 10, skip: 0, take: 10 };

test("monthly number allocation stays unique under concurrent database transactions", { skip: !local }, async () => {
  const database = getDatabase();
  const companyId = randomUUID();
  const code = `T${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
  try {
    await database.company.create({ data: { id: companyId, name: "Temporary numbering concurrency fixture", code } });
    const numbers = await Promise.all(Array.from({ length: 8 }, () => database.$transaction((tx) => allocate_request_number(companyId, code, new Date("2026-10-01T00:00:00Z"), tx))));
    assert.equal(new Set(numbers).size, 8);
    assert.deepEqual(numbers.map((number) => Number(number.split("-").at(-1))).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8]);
  } finally {
    await database.material_request_counter.deleteMany({ where: { company_id: companyId } });
    await database.company.deleteMany({ where: { id: companyId } });
    await closeDatabase();
  }
});

test("material requests enforce companies and hub assignments, allocate numbers on submit, preserve snapshots and timeline", { skip: !local }, async () => {
  const database = getDatabase();
  const state = globalThis as typeof globalThis & { fuelDatabase?: { database: Database } };
  const original = state.fuelDatabase;
  const rollback = new Error("Rollback material request fixtures");
  try {
    await assert.rejects(database.$transaction(async (tx) => {
      state.fuelDatabase = { database: new Proxy(tx, { get(target, key) {
        if (key === "$transaction") return async (run: (client: typeof tx) => unknown) => run(tx);
        return Reflect.get(target, key);
      } }) as unknown as Database };
      const actor = randomUUID();
      const requesterId = randomUUID();
      const supplierId = randomUUID();
      const outsiderId = randomUUID();
      const code = `T${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
      await tx.user.create({ data: { id: actor, name: "Request creator" } });
      await tx.company.createMany({ data: [{ id: requesterId, name: "Requester", code }, { id: supplierId, name: "Warehouse company" }, { id: outsiderId, name: "Unlinked company" }] });
      const hub = await tx.location.create({ data: { company_id: requesterId, type: "hub", name: "Manila Hub" } });
      const otherHub = await tx.location.create({ data: { company_id: requesterId, type: "hub", name: "Unassigned hub" } });
      const warehouse = await tx.location.create({ data: { company_id: supplierId, type: "warehouse", name: "Central warehouse" } });
      const link = await tx.company_supply_relationship.create({ data: { requesting_company_id: requesterId, supplying_company_id: supplierId, created_by: actor } });
      const membership = await tx.user_company.create({ data: { user_id: actor, company_id: requesterId } });
      await tx.user_location.create({ data: { user_company_id: membership.id, company_id: requesterId, location_id: hub.id, assigned_by: actor } });
      const measurement = await tx.measurement.create({ data: { name: "Request volume", company_id: supplierId } });
      const unit = await tx.measurement_unit.create({ data: { measurement_id: measurement.id, key: "litre", name: "Litre", symbol: "L" } });
      const brand = await tx.brand.create({ data: { company_id: supplierId, name: "Supplier brand" } });
      const variant = await tx.variant.create({ data: { company_id: supplierId, brand_id: brand.id, name: "Premium" } });
      const type = await tx.product_type.create({ data: { company_id: supplierId, name: "Fuel", key: "fuel" } });
      const product = await tx.product.create({ data: { company_id: supplierId, variant_id: variant.id, product_type_id: type.id, base_unit_id: unit.id } });
      const admin: RecordAccess = { userId: actor, superAdmin: true, companyIds: [], pages: [], grants: [] };
      const requester: RecordAccess = { userId: actor, superAdmin: false, companyIds: [requesterId], pages: ["materialRequests"], grants: ["view", "add", "edit"].map((action) => ({ permission: `materialRequests.${action}`, companyId: requesterId, scope: "own" })) };
      const supplier: RecordAccess = { ...requester, companyIds: [supplierId], grants: ["view", "edit"].map((action) => ({ permission: `materialRequests.${action}`, companyId: supplierId, scope: "company" })) };
      const outsider: RecordAccess = { ...requester, companyIds: [outsiderId], grants: [{ permission: "materialRequests.view", companyId: outsiderId, scope: "company" }] };
      const input = { requesting_hub_id: hub.id, supplying_company_id: supplierId, needed_at: "2026-10-25", items: [{ product_id: product.id, requested_qty: "12.500" }] };
      const catalog = await service.get_material_request_catalog(hub.id, supplierId, "Premium", pagination, requester);
      assert.equal(catalog.total, 1);
      assert.deepEqual(Object.keys(catalog.products[0]).sort(), ["id", "label", "unit_id", "unit_label"]);
      await assert.rejects(service.get_material_request_catalog(hub.id, outsiderId, "", pagination, requester), { status: 403 });
      await assert.rejects(service.create_material_request({ ...input, requesting_hub_id: otherHub.id }, requester), { status: 403 });
      await assert.rejects(service.create_material_request({ ...input, items: [{ product_id: product.id, requested_qty: "0" }] }, requester), { status: 400 });
      await assert.rejects(service.create_material_request({ ...input, items: [input.items[0], input.items[0]] }, requester), { status: 400 });
      const draft = await service.create_material_request(input, requester);
      assert.equal(draft.request_no, null);
      assert.equal(draft.created_by, actor);
      assert.equal(draft.events[0].kind, "created");
      await assert.rejects(service.list_by_id_material_request(draft.id, supplier), { status: 404 });
      await assert.rejects(service.list_by_id_material_request(draft.id, outsider), { status: 404 });
      assert.equal((await service.list_material_request("", "", pagination, supplier)).total, 0);
      await service.update_material_request(draft.id, { ...input, notes: "Please deliver" }, requester);
      await tx.company_supply_relationship.update({ where: { id: link.id }, data: { is_active: false } });
      await assert.rejects(service.action_material_request({ id: draft.id, action: "submit" }, requester), { status: 409 });
      assert.equal((await tx.material_request_counter.count({ where: { company_id: requesterId } })), 0);
      await tx.company_supply_relationship.update({ where: { id: link.id }, data: { is_active: true } });
      const submitted = await service.action_material_request({ id: draft.id, action: "submit" }, requester);
      assert.match(submitted.request_no!, new RegExp(`^MR-${code}-\\d{6}-0000001$`));
      assert.equal(submitted.status, "submitted");
      assert.equal((await service.list_by_id_material_request(draft.id, supplier)).permissions.review, true);
      await assert.rejects(service.action_material_request({ id: draft.id, action: "submit" }, requester), { status: 409 });
      await assert.rejects(service.update_material_request(draft.id, input, requester), { status: 409 });
      await assert.rejects(service.action_material_request({ id: draft.id, action: "approve", supplying_warehouse_id: warehouse.id }, requester), { status: 403 });
      await assert.rejects(service.action_material_request({ id: draft.id, action: "approve", supplying_warehouse_id: hub.id }, supplier), { status: 400 });
      await assert.rejects(update_company({ id: requesterId, name: "Requester", code: "CHANGED" }, undefined, admin), /cannot change/);
      await tx.variant.update({ where: { id: variant.id }, data: { name: "Renamed" } });
      const approved = await service.action_material_request({ id: draft.id, action: "approve", supplying_warehouse_id: warehouse.id }, supplier);
      assert.equal(approved.items[0].approved_qty, "12.5");
      assert.match(approved.items[0].product_label, /Premium/);
      assert.equal(approved.supplying_warehouse_id, warehouse.id);
      assert.deepEqual(approved.events.map((event) => event.kind), ["created", "updated", "submitted", "approved"]);
      assert.equal(approved.request_no, submitted.request_no);
      await assert.rejects(service.action_material_request({ id: draft.id, action: "cancel" }, requester), { status: 409 });
      const another = await service.create_material_request(input, requester);
      const next = await service.action_material_request({ id: another.id, action: "submit" }, requester);
      assert.match(next.request_no!, /-0000002$/);
      await assert.rejects(service.action_material_request({ id: next.id, action: "reject" }, supplier), { status: 400 });
      const rejected = await service.action_material_request({ id: next.id, action: "reject", note: "Not available" }, supplier);
      assert.equal(rejected.status, "rejected");
      const cancelledDraft = await service.create_material_request(input, requester);
      const cancelled = await service.action_material_request({ id: cancelledDraft.id, action: "cancel" }, requester);
      assert.equal(cancelled.request_no, null);
      const beforeBoundary = await allocate_request_number(requesterId, code, new Date("2026-10-31T15:59:59Z"), tx);
      const afterBoundary = await allocate_request_number(requesterId, code, new Date("2026-10-31T16:00:00Z"), tx);
      assert.match(beforeBoundary, /-202610-/);
      assert.match(afterBoundary, /-202611-0000001$/);
      throw rollback;
    }, { timeout: 30_000 }), (error) => error === rollback);
  } finally { state.fuelDatabase = original; await closeDatabase(); }
});
