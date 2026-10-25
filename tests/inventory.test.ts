import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";
import * as controller from "@/server/controllers/inventory_controller";
import * as receiving from "@/server/controllers/receiving_controller";
import { record_where, requirePermission, type RecordAccess } from "@/server/auth/record-access";
import { PAGE_CATALOG } from "@/lib/auth/catalog";
import { PERMISSION_CATALOG } from "@/lib/auth/permissions";
import { inventoryPaths } from "@/lib/openapi/openapi-inventory";
import { openapi } from "@/lib/openapi/openapi";
import { createQuickFilterState } from "@/utils/quick-filter";
import { listSidebarMenu } from "@/app/layout/sideBarMenuItems";

const actor = "10000000-0000-4000-8000-000000000001";
const company = "20000000-0000-4000-8000-000000000001";
const access: RecordAccess = { userId: actor, superAdmin: false, companyIds: [company], pages: ["inventory"], grants: [{ permission: "inventory.view", scope: "company", companyId: company }] };

function response(scope = access) {
  const result = { status: 0, body: undefined as unknown };
  const res = { locals: { access: scope }, status: (status: number) => { result.status = status; return res; }, json: (body: unknown) => { result.body = body; return res; } };
  return { res: res as unknown as Response, result };
}

test("inventory ownership follows the facility and own access requires current assignments", () => {
  assert.deepEqual(record_where(access, "inventory"), { OR: [{ facility: { company_id: { in: [company] } } }] });
  assert.deepEqual(record_where({ ...access, grants: [{ ...access.grants[0], scope: "own" }] }, "inventory"), {
    OR: [{ facility: { company_id: { in: [company] }, users: { some: { membership: { user_id: actor } } } } }],
  });
  assert.deepEqual(record_where({ ...access, grants: [] }, "inventory"), { id: { in: [] } });
  assert.deepEqual(record_where({ ...access, grants: [{ permission: "inventory.view", scope: "all", companyId: null }] }, "inventory"), {});
  assert.deepEqual(record_where({ ...access, superAdmin: true }, "inventory"), {});
  assert.deepEqual(record_where({ ...access, companyIds: [company, actor] }, "inventory"), record_where(access, "inventory"));
});

test("inventory middleware denies requests without view permission", () => {
  const { res, result } = response({ ...access, grants: [] });
  let proceeded = false;
  requirePermission("inventory", "view")({} as Request, res, () => { proceeded = true; });
  assert.equal(result.status, 403);
  assert.equal(proceeded, false);
});

test("inventory controllers reject malformed IDs, search, pagination, sorting and filters before querying", async () => {
  const filters = createQuickFilterState({ status: "all", additional: { facility_type: "all" } });
  filters.conditions = [{ id: "invalid", field: "facility", value: "not-a-uuid" }];
  const cases: Array<[typeof controller.list_inventory, Record<string, unknown>]> = [
    [controller.list_inventory, { search: [] }], [controller.list_inventory, { search: "x".repeat(161) }],
    [controller.list_inventory, { page: "0" }], [controller.list_inventory, { page_size: "100000" }],
    [controller.list_inventory, { sort_by: "created_by" }], [controller.list_inventory, { sort_order: "sideways" }],
    [controller.list_inventory, { filters: "not-json" }], [controller.list_inventory, { filters: JSON.stringify(filters) }],
    [controller.list_by_id_inventory, { id: [] }], [controller.list_by_id_inventory, { id: "invalid" }],
    [controller.list_stock_movement, {}], [controller.list_stock_movement, { inventory_id: "invalid" }],
    [controller.list_stock_movement, { inventory_id: actor, page: "-1" }],
    [controller.list_stock_movement, { inventory_id: actor, sort_by: "company" }],
    [controller.list_inventory_brand, { search: [] }], [controller.list_inventory_brand, { page: "0" }],
    [controller.list_inventory_brand, { filters: JSON.stringify(filters) }],
    [controller.list_inventory_brand, { sort_by: "unknown" }], [controller.list_inventory_brand, { sort_by: "brand", sort_order: "unknown" }],
    [controller.get_inventory_history, { inventory_id: "invalid" }], [controller.get_inventory_history, { inventory_id: actor, search: [] }],
    [controller.get_inventory_history, { inventory_id: actor, filters: "invalid" }],
    [controller.get_inventory_history, { inventory_id: actor, sort_by: "unknown" }],
    [controller.export_inventory_history, { inventory_id: "invalid" }], [controller.export_inventory_history, { inventory_id: actor, search: [] }],
    [controller.export_inventory_history, { inventory_id: actor, sort_by: "unknown" }],
  ];
  for (const [handler, query] of cases) {
    const { res, result } = response();
    await handler({ query } as unknown as Request, res);
    assert.equal(result.status, 400, JSON.stringify(query));
    assert.equal(typeof (result.body as { error: unknown }).error, "string");
  }
});

test("receipt writes validate identifiers before row locking", async () => {
  for (const handler of [receiving.create_receiving, receiving.update_receiving, receiving.post_receiving, receiving.delete_receiving]) {
    const { res, result } = response();
    await handler({ body: {}, query: {} } as Request, res);
    assert.equal(result.status, 400);
  }
});

test("inventory registers only view permission, enables navigation, and documents every read", () => {
  assert.deepEqual(PERMISSION_CATALOG.filter((permission) => permission.page_key === "inventory").map((permission) => permission.key), ["inventory.view"]);
  assert.equal(PAGE_CATALOG.find((page) => page.key === "inventory")?.navigation, true);
  for (const path of ["/api/inventory", "/api/inventory/movements", "/api/inventory/filter-options", "/api/inventory/brands", "/api/inventory/history", "/api/inventory/export"] as const) {
    assert.ok(inventoryPaths[path].get);
    assert.ok(openapi.paths[path]);
    assert.deepEqual(Object.keys(inventoryPaths[path]), ["get"]);
  }
});

test("inventory is a direct sidebar link for Super Admin and authorized staff", () => {
  const admin = listSidebarMenu([], { role: "super_admin" });
  assert.ok(admin.some((item) => item.label === "Inventory" && item.href === "/inventory" && !item.children));
  assert.ok(admin.some((item) => item.label === "Procurement"));
  const staff = listSidebarMenu(["inventory"], { permissions: ["inventory.view"] });
  assert.deepEqual(staff.map((item) => item.href), ["/inventory"]);
  assert.equal(listSidebarMenu(["inventory"], { permissions: [] }).length, 0);
});
