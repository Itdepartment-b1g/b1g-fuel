import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { test } from "node:test";
import { Client } from "pg";
import type { Request, Response } from "express";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import type { RecordAccess } from "@/server/auth/record-access";
import * as inventory from "@/server/services/inventory_service";
import * as inventoryController from "@/server/controllers/inventory_controller";
import * as receiving from "@/server/services/receiving_service";
import * as requests from "@/server/services/material_requests_service";
import { createQuickFilterState } from "@/utils/quick-filter";

const url = process.env.DATABASE_URL;
const local = url && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(url).hostname);
const pagination = { page: 1, page_size: 10, skip: 0, take: 10 };

test("inventory backend posts stock atomically and scopes reads by facility", { skip: !local }, async (t) => {
  const client = new Client({ connectionString: url });
  const schema = `inventory_backend_${randomUUID().replaceAll("-", "")}`;
  const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, options: `-c search_path=${schema}` }, { schema }) });
  const state = globalThis as typeof globalThis & { fuelDatabase?: { database: PrismaClient } };
  const original = state.fuelDatabase;
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    const migrations = new URL("../prisma/migrations/", import.meta.url);
    const entries = await readdir(migrations, { withFileTypes: true });
    for (const name of entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()) {
      await client.query(await readFile(new URL(`${name}/migration.sql`, migrations), "utf8"));
    }
    state.fuelDatabase = { database };
    const actor = randomUUID();
    await database.user.create({ data: { id: actor, name: "Stock operator" } });
    const supplierCompany = await database.company.create({ data: { name: "Supplier company" } });
    const hubCompany = await database.company.create({ data: { name: "Hub company" } });
    const outsideCompany = await database.company.create({ data: { name: "Outside company" } });
    const warehouse = await database.facility.create({ data: { company_id: supplierCompany.id, name: "Warehouse", type: "warehouse" } });
    const hub = await database.facility.create({ data: { company_id: hubCompany.id, name: "Assigned hub", type: "hub" } });
    const unassignedHub = await database.facility.create({ data: { company_id: hubCompany.id, name: "Unassigned hub", type: "hub" } });
    const outside = await database.facility.create({ data: { company_id: outsideCompany.id, name: "Outside warehouse", type: "warehouse" } });
    const membership = await database.user_company.create({ data: { user_id: actor, company_id: hubCompany.id } });
    await database.user_facility.create({ data: { company_id: hubCompany.id, user_company_id: membership.id, facility_id: hub.id, assigned_by: actor } });
    const measurement = await database.measurement.create({ data: { company_id: supplierCompany.id, name: "Volume" } });
    const unit = await database.measurement_unit.create({ data: { measurement_id: measurement.id, key: "litre", name: "Litre", symbol: "L" } });
    const container = await database.measurement_unit.create({ data: { measurement_id: measurement.id, key: "container", name: "Container", symbol: "can" } });
    const brand = await database.brand.create({ data: { company_id: supplierCompany.id, name: "Stock brand" } });
    const type = await database.product_type.create({ data: { company_id: supplierCompany.id, name: "Fuel", key: "fuel" } });
    const products: { id: string }[] = [];
    for (const name of ["Premium", "Regular"]) {
      const variant = await database.variant.create({ data: { company_id: supplierCompany.id, brand_id: brand.id, name } });
      products.push(await database.product.create({ data: { id: products.length ? "20000000-0000-4000-8000-000000000001" : "10000000-0000-4000-8000-000000000001", company_id: supplierCompany.id, variant_id: variant.id, product_type_id: type.id, base_unit_id: unit.id } }));
    }
    const supplier = await database.supplier.create({ data: { company_id: supplierCompany.id, name: "Supplier", contact_person: "Contact", contact_email: "supplier@example.test", contact_phone: "123", contact_address: "Address" } });
    const order = await database.purchase_order.create({ data: {
      company_id: supplierCompany.id, facility_id: warehouse.id, supplier_id: supplier.id, order_seq: 1, purchase_order_no: "TEST-PO-1", status: "awaiting_receipt", payment_terms: "COD", created_by: actor,
      items: { create: products.map((product, index) => ({ product_id: product.id, unit_id: index ? unit.id : container.id, ordered_qty: "10" })) },
    }, include: { items: true } });
    const admin: RecordAccess = { userId: actor, superAdmin: true, companyIds: [], pages: [], grants: [] };
    const access = (companyId: string, scope: "own" | "company" = "company"): RecordAccess => ({ userId: actor, superAdmin: false, companyIds: [companyId], pages: ["inventory"], grants: [{ permission: "inventory.view", scope, companyId }] });
    const receipt = await database.receiving.create({ data: {
      company_id: supplierCompany.id, facility_id: warehouse.id, purchase_order_id: order.id, created_by: actor,
      items: { create: order.items.map((item) => {
        const first = item.product_id === products[0].id;
        return { purchase_order_item_id: item.id, product_id: item.product_id, unit_id: item.unit_id, qty: first ? "2.5" : "1", content_per_unit: first ? "4" : "1", base_qty: first ? "10" : "1" };
      }) },
    } });

    await t.test("concurrent posting adds each receipt base quantity exactly once", async () => {
      const results = await Promise.allSettled([receiving.post_receiving(receipt.id, admin), receiving.post_receiving(receipt.id, admin)]);
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      const rejected = results.find((result) => result.status === "rejected");
      assert.equal(rejected?.status === "rejected" && rejected.reason.code, "conflict");
      assert.equal(await database.stock_movement.count({ where: { type: "po_receive_in" } }), 2);
      assert.equal((await database.inventory.findUniqueOrThrow({ where: { facility_id_product_id: { facility_id: warehouse.id, product_id: products[0].id } } })).qty.toString(), "10");
      assert.equal((await database.purchase_order_item.findUniqueOrThrow({ where: { purchase_order_id_product_id: { purchase_order_id: order.id, product_id: products[0].id } } })).received_qty.toString(), "2.5");
      assert.equal((await database.purchase_order.findUniqueOrThrow({ where: { id: order.id } })).status, "partially_received");
      await assert.rejects(receiving.update_receiving({ id: receipt.id, purchase_order_id: order.id, lines: [{ purchase_order_item_id: order.items[0].id, qty: "1" }] }, admin), { code: "conflict" });
      await assert.rejects(receiving.delete_receiving(receipt.id, admin), { code: "conflict" });
    });

    await t.test("an over-receipt on a later line leaves every PO total and stock balance unchanged", async () => {
      const invalid = await database.receiving.create({ data: {
        company_id: supplierCompany.id, facility_id: warehouse.id, purchase_order_id: order.id,
        items: { create: order.items.map((item, index) => ({ purchase_order_item_id: item.id, product_id: item.product_id, unit_id: item.unit_id, qty: index ? "100" : "1", base_qty: index ? "100" : "1" })) },
      } });
      const before = await database.purchase_order_item.findMany({ where: { purchase_order_id: order.id }, orderBy: { id: "asc" } });
      await assert.rejects(receiving.post_receiving(invalid.id, admin), { code: "invalid_input" });
      assert.deepEqual((await database.purchase_order_item.findMany({ where: { purchase_order_id: order.id }, orderBy: { id: "asc" } })).map((row) => row.received_qty.toString()), before.map((row) => row.received_qty.toString()));
      assert.equal(await database.stock_movement.count(), 2);
      await database.receiving.delete({ where: { id: invalid.id } });
    });

    const relationship = await database.company_supply_relationship.create({ data: { requesting_company_id: hubCompany.id, supplying_company_id: supplierCompany.id, created_by: actor } });
    const makeRequest = () => database.material_request.create({ data: {
      requesting_company_id: hubCompany.id, supplying_company_id: supplierCompany.id, requesting_hub_id: hub.id, supplying_warehouse_id: warehouse.id, supply_relationship_id: relationship.id,
      status: "approved", request_no: `MR-TEST-${randomUUID()}`, submitted_at: new Date(), created_by: actor,
      items: { create: products.map((product) => ({ product_id: product.id, unit_id: unit.id, requested_qty: "6", approved_qty: "6", product_label: "Fuel", unit_label: "L" })) },
    }, include: { items: true } });

    await t.test("insufficient stock rolls back dispatch documents, prior deductions, movements and progress", async () => {
      const request = await makeRequest();
      const before = (await database.inventory.findMany({ where: { facility_id: warehouse.id }, orderBy: { product_id: "asc" } })).map((row) => row.qty.toString());
      await assert.rejects(requests.dispatch_material_request({ id: request.id, lines: request.items.map((item) => ({ material_request_item_id: item.id, qty: "6" })) }, admin), { status: 409 });
      assert.equal(await database.material_request_dispatch.count({ where: { material_request_id: request.id } }), 0);
      assert.equal(await database.stock_movement.count(), 2);
      assert.deepEqual((await database.inventory.findMany({ where: { facility_id: warehouse.id }, orderBy: { product_id: "asc" } })).map((row) => row.qty.toString()), before);
      const unchanged = await database.material_request.findUniqueOrThrow({ where: { id: request.id }, include: { items: true, events: true } });
      assert.equal(unchanged.status, "approved");
      assert.ok(unchanged.items.every((item) => item.dispatched_qty.isZero()));
      assert.equal(unchanged.events.length, 0);
    });

    await t.test("competing dispatches cannot overdraw stock and a hub receipt adds stock once", async () => {
      const first = await makeRequest();
      const second = await makeRequest();
      const results = await Promise.allSettled([first, second].map((request) => requests.dispatch_material_request({ id: request.id, lines: [{ material_request_item_id: request.items.find((item) => item.product_id === products[0].id)!.id, qty: "6" }] }, admin)));
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      const index = results.findIndex((result) => result.status === "fulfilled");
      const successful = [first, second][index];
      const item = successful.items.find((row) => row.product_id === products[0].id)!;
      assert.equal((await database.inventory.findUniqueOrThrow({ where: { facility_id_product_id: { facility_id: warehouse.id, product_id: products[0].id } } })).qty.toString(), "4");
      const input = { id: successful.id, lines: [{ material_request_item_id: item.id, qty: "6" }] };
      await requests.receive_material_request(input, admin);
      await assert.rejects(requests.receive_material_request(input, admin), { status: 409 });
      assert.equal((await database.inventory.findUniqueOrThrow({ where: { facility_id_product_id: { facility_id: hub.id, product_id: products[0].id } } })).qty.toString(), "6");
    });

    await t.test("reads, filters and movement history respect facility ownership and current assignments", async () => {
      await database.inventory.createMany({ data: [{ facility_id: unassignedHub.id, product_id: products[0].id }, { facility_id: outside.id, product_id: products[0].id, qty: "9" }] });
      const own = access(hubCompany.id, "own");
      const balances = await inventory.list_inventory(pagination, "", undefined, undefined, own);
      assert.equal(balances.total, 1);
      assert.equal(balances.inventories[0].company.id, hubCompany.id);
      assert.equal(balances.inventories[0].product.brand.id, brand.id);
      assert.equal(balances.inventories[0].product.base_unit.symbol, "L");
      assert.equal(typeof balances.inventories[0].qty, "string");
      const detail = await inventory.list_by_id_inventory(balances.inventories[0].id, own);
      const movements = await inventory.list_stock_movement(detail.id, pagination, undefined, own);
      assert.equal(movements.total, 1);
      assert.equal(movements.movements[0].type, "receive_in");
      assert.equal(movements.movements[0].created_by_name, "Stock operator");
      assert.equal(Object.hasOwn(movements.movements[0], "request"), false);
      const warehouseBalance = await database.inventory.findUniqueOrThrow({ where: { facility_id_product_id: { facility_id: warehouse.id, product_id: products[0].id } } });
      await assert.rejects(inventory.list_by_id_inventory(warehouseBalance.id, own), { code: "not_found" });
      await assert.rejects(inventory.list_stock_movement(warehouseBalance.id, pagination, undefined, own), { code: "not_found" });
      const warehouseHistory = await inventory.list_stock_movement(warehouseBalance.id, { ...pagination, take: 1, page_size: 1 }, { field: "created_at", direction: "asc" }, access(supplierCompany.id));
      assert.equal(warehouseHistory.total, 2);
      assert.equal(warehouseHistory.movements.length, 1);
      assert.equal(warehouseHistory.movements[0].type, "po_receive_in");
      assert.equal(warehouseHistory.movements[0].qty, "10");
      const choices = await inventory.get_inventory_filter_option(own);
      assert.deepEqual(choices.fields.find((field) => field.key === "company")!.options.map((option) => option.value), [hubCompany.id]);
      assert.deepEqual(choices.fields.find((field) => field.key === "facility")!.options.map((option) => option.value), [hub.id]);
      assert.equal((await inventory.list_inventory(pagination, "", undefined, undefined, { ...own, grants: [] })).total, 0);
      assert.equal((await inventory.list_inventory(pagination, "", undefined, undefined, access(hubCompany.id))).total, 2);
      const filters = createQuickFilterState({ status: "all", additional: { facility_type: "all" } });
      filters.status = "zero";
      assert.equal((await inventory.list_inventory(pagination, "", undefined, filters, access(hubCompany.id))).total, 1);
      filters.status = "all";
      filters.additional.facility_type = "warehouse";
      assert.equal((await inventory.list_inventory(pagination, "", undefined, filters, access(hubCompany.id))).total, 0);
      for (const [field, value] of [["company", hubCompany.id], ["facility", hub.id], ["brand", brand.id], ["variant", detail.product.variant.id], ["product_type", type.id]]) {
        const condition = createQuickFilterState({ status: "all", additional: { facility_type: "all" } });
        condition.conditions = [{ id: "condition", field, value }];
        assert.equal((await inventory.list_inventory(pagination, "", undefined, condition, own)).total, 1, field);
        condition.conditions[0].value = randomUUID();
        assert.equal((await inventory.list_inventory(pagination, "", undefined, condition, own)).total, 0, field);
      }
      assert.equal((await inventory.list_inventory(pagination, "Premium", undefined, undefined, access(supplierCompany.id))).total, 1);
      const sorted = await inventory.list_inventory({ ...pagination, page_size: 1, take: 1 }, "", { field: "qty", direction: "desc" }, undefined, access(supplierCompany.id));
      assert.equal(sorted.total, 2);
      assert.equal(sorted.inventories.length, 1);
      assert.equal(sorted.inventories[0].qty, "4");
      await database.facility.update({ where: { id: hub.id }, data: { is_active: false } });
      assert.equal((await inventory.list_by_id_inventory(detail.id, own)).facility.is_active, false);
      await database.user_facility.deleteMany({ where: { facility_id: hub.id } });
      await assert.rejects(inventory.list_by_id_inventory(detail.id, own), { code: "not_found" });
    });

    await t.test("brand pagination keeps variants together, separates units and dates only the ledger", async () => {
      const count = await database.measurement.create({ data: { company_id: supplierCompany.id, name: "Count" } });
      const pieces = await database.measurement_unit.create({ data: { measurement_id: count.id, key: "piece", name: "Piece", symbol: "pcs" } });
      const variant = await database.variant.create({ data: { company_id: supplierCompany.id, brand_id: brand.id, name: "Container" } });
      const product = await database.product.create({ data: { company_id: supplierCompany.id, variant_id: variant.id, product_type_id: type.id, base_unit_id: pieces.id } });
      await database.inventory.create({ data: { facility_id: warehouse.id, product_id: product.id, qty: "8" } });
      const otherBrand = await database.brand.create({ data: { company_id: supplierCompany.id, name: "Zed brand" } });
      const otherVariant = await database.variant.create({ data: { company_id: supplierCompany.id, brand_id: otherBrand.id, name: "Zed variant" } });
      const otherProduct = await database.product.create({ data: { company_id: supplierCompany.id, variant_id: otherVariant.id, product_type_id: type.id, base_unit_id: unit.id } });
      await database.inventory.create({ data: { facility_id: warehouse.id, product_id: otherProduct.id, qty: "2" } });
      const result = await inventory.list_inventory_brand({ ...pagination, take: 1, page_size: 1 }, "", undefined, access(supplierCompany.id));
      assert.equal(result.total, 2);
      assert.equal(result.brands.length, 1);
      assert.equal(result.brands[0].variants.length, 3);
      assert.equal(result.brands[0].sku_count, 3);
      assert.deepEqual(result.brands[0].totals, [{ unit: "Piece (pcs)", qty: "8", net_movement: "0" }, { unit: "Litre (L)", qty: "5", net_movement: "5" }]);
      const firstPage = { ...pagination, take: 1, page_size: 1 };
      const descending = await inventory.list_inventory_brand(firstPage, "", undefined, access(supplierCompany.id), { field: "brand", direction: "desc" });
      assert.equal(descending.brands[0].id, otherBrand.id);
      const fewestSkus = await inventory.list_inventory_brand(firstPage, "", undefined, access(supplierCompany.id), { field: "skus", direction: "asc" });
      assert.equal(fewestSkus.brands[0].id, otherBrand.id);
      const mostSkus = await inventory.list_inventory_brand(firstPage, "", undefined, access(supplierCompany.id), { field: "skus", direction: "desc" });
      assert.equal(mostSkus.brands[0].id, brand.id);
      const nextPage = await inventory.list_inventory_brand({ ...firstPage, page: 2, skip: 1 }, "", undefined, access(supplierCompany.id), { field: "skus", direction: "asc" });
      assert.equal(nextPage.brands[0].id, brand.id);
      const sku = await inventory.list_inventory_brand(pagination, products[0].id, undefined, access(supplierCompany.id));
      assert.equal(sku.brands[0].sku_count, 1);
      assert.equal(sku.brands[0].variants[0].qty, "4");
      const dates = createQuickFilterState({ status: "all", additional: { facility_type: "all" } });
      dates.date = { preset: "custom", from: "2020-01-01", to: "2020-12-31" };
      const dated = await inventory.list_inventory_brand(pagination, products[0].id, dates, access(supplierCompany.id));
      assert.equal(dated.brands[0].variants[0].net_movement, "0");
      assert.equal(dated.brands[0].variants[0].qty, "4");
      assert.equal((await inventory.list_inventory_brand(pagination, "", undefined, { ...access(supplierCompany.id), grants: [] })).total, 0);
      const thirdBrand = await database.brand.create({ data: { company_id: supplierCompany.id, name: "Third brand" } });
      const thirdVariant = await database.variant.create({ data: { company_id: supplierCompany.id, brand_id: thirdBrand.id, name: "Third variant" } });
      const thirdProduct = await database.product.create({ data: { company_id: supplierCompany.id, variant_id: thirdVariant.id, product_type_id: type.id, base_unit_id: unit.id } });
      const thirdOrder = await database.purchase_order.create({ data: {
        company_id: supplierCompany.id, facility_id: warehouse.id, supplier_id: supplier.id, order_seq: 2, purchase_order_no: "TEST-PO-2", status: "awaiting_receipt", payment_terms: "COD",
        items: { create: { product_id: thirdProduct.id, unit_id: unit.id, ordered_qty: "20" } },
      }, include: { items: true } });
      const thirdReceipt = await receiving.create_receiving({ purchase_order_id: thirdOrder.id, lines: [{ purchase_order_item_id: thirdOrder.items[0].id, qty: "20" }] }, admin);
      await receiving.post_receiving(thirdReceipt.id, admin);
      const matching = createQuickFilterState({ status: "all", additional: { facility_type: "all" } });
      matching.conditions = [otherBrand, thirdBrand].map((row) => ({ id: row.id, field: "brand", value: row.id }));
      for (const field of ["stock", "movement"]) {
        const largest = await inventory.list_inventory_brand(firstPage, "", matching, access(supplierCompany.id), { field, direction: "desc" });
        assert.equal(largest.total, 2);
        assert.equal(largest.brands[0].id, thirdBrand.id);
        const smallest = await inventory.list_inventory_brand(firstPage, "", matching, access(supplierCompany.id), { field, direction: "asc" });
        assert.equal(smallest.brands[0].id, otherBrand.id);
      }
    });

    await t.test("brands controller accepts the inventory page's default filter request", async () => {
      const result = { status: 0, body: undefined as unknown };
      const res = {
        locals: { access: admin },
        status(code: number) { result.status = code; return this; },
        json(body: unknown) { result.body = body; return this; },
      } as unknown as Response;
      await inventoryController.list_inventory_brand({ query: {
        search: "", page: "1", page_size: "10",
        filters: JSON.stringify({ date: { preset: "all", from: "", to: "" }, conditions: [{ id: "9e0c93c0-69df-46f1-b92d-b14341be010d", field: "", value: "" }], status: "all", additional: { facility_type: "all" } }),
      } } as unknown as Request, res);
      assert.equal(result.status, 200);
      const body = result.body as { brands: unknown[]; total: number; page: number; page_size: number };
      assert.ok(body.brands.length > 0);
      assert.equal(body.page, 1);
      assert.equal(body.page_size, 10);
    });

    await t.test("history exposes saved balances, period totals, source references and all filtered export rows", async () => {
      const balance = await database.inventory.findUniqueOrThrow({ where: { facility_id_product_id: { facility_id: warehouse.id, product_id: products[0].id } } });
      const history = await inventory.get_inventory_history(balance.id, { ...pagination, take: 1, page_size: 1 }, "", undefined, access(supplierCompany.id));
      assert.equal(history.total, 2);
      assert.equal(history.movements.length, 1);
      assert.equal(history.movements[0].balance_before, "10");
      assert.equal(history.movements[0].balance_after, "4");
      assert.equal(history.movements[0].source_href, null);
      const oldest = await inventory.get_inventory_history(balance.id, { ...pagination, take: 1, page_size: 1 }, "", undefined, admin, { field: "created_at", direction: "asc" });
      assert.equal(oldest.movements[0].type, "po_receive_in");
      const smallest = await inventory.get_inventory_history(balance.id, { ...pagination, take: 1, page_size: 1 }, "", undefined, admin, { field: "qty", direction: "asc" });
      assert.equal(smallest.movements[0].qty, "6");
      const highestBalance = await inventory.get_inventory_history(balance.id, { ...pagination, take: 1, page_size: 1 }, "", undefined, admin, { field: "balance_after", direction: "desc" });
      assert.equal(highestBalance.movements[0].balance_after, "10");
      assert.deepEqual(history.summary, { stock_in: "10", stock_out: "6", net_movement: "4", current_stock: "4", beginning_balance: "0", ending_balance: "4" });
      const filters = createQuickFilterState({ status: "all", additional: { transaction_type: "all" } });
      filters.status = "out";
      const outgoing = await inventory.get_inventory_history(balance.id, pagination, "", filters, admin);
      assert.equal(outgoing.total, 1);
      assert.match(outgoing.movements[0].reference_no, /^MRD-/);
      assert.match(outgoing.movements[0].source_href!, /^\/material-requests\?search=/);
      assert.equal(outgoing.summary.stock_in, "10");
      const searched = await inventory.get_inventory_history(balance.id, pagination, outgoing.movements[0].reference_no, undefined, admin);
      assert.equal(searched.total, 1);
      assert.equal(searched.movements[0].type, "dispatch_out");
      filters.status = "all";
      filters.additional.transaction_type = "po_receive_in";
      const receipts = await inventory.get_inventory_history(balance.id, pagination, "", filters, admin);
      assert.equal(receipts.total, 1);
      assert.equal(receipts.movements[0].balance_before, "0");
      assert.equal(receipts.movements[0].balance_after, "10");
      const exported = await inventory.export_inventory_history(balance.id, "", undefined, admin);
      assert.equal((exported.match(/<Row>/g) ?? []).length, 3);
      assert.ok(exported.includes("Litre (L)"));
      const oldestExport = await inventory.export_inventory_history(balance.id, "", undefined, admin, { field: "created_at", direction: "asc" });
      assert.ok(oldestExport.indexOf("po_receive_in") < oldestExport.indexOf("dispatch_out"));
      const filteredExport = await inventory.export_inventory_history(balance.id, outgoing.movements[0].reference_no, undefined, admin);
      assert.equal((filteredExport.match(/<Row>/g) ?? []).length, 2);
      filters.date = { preset: "custom", from: "2020-01-01", to: "2020-12-31" };
      const old = await inventory.get_inventory_history(balance.id, pagination, "", filters, admin);
      assert.equal(old.total, 0);
      assert.equal(old.summary.beginning_balance, null);
      assert.equal(old.summary.ending_balance, null);
      await assert.rejects(inventory.get_inventory_history(balance.id, pagination, "", undefined, access(hubCompany.id)), { code: "not_found" });
      await assert.rejects(inventory.export_inventory_history(balance.id, "", undefined, access(hubCompany.id)), { code: "not_found" });
    });
  } finally {
    state.fuelDatabase = original;
    await database.$disconnect();
    await client.query("ROLLBACK");
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  }
});
