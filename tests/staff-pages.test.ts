import assert from "node:assert/strict";
import { test } from "node:test";
import { staff_role_slug, staff_role_slug_candidates } from "@/lib/auth/role-slug";
import { allowed_staff_pages, parse_page_keys, selected_staff_permissions, UserError } from "@/server/services/users_service";

test("a supervisor can check a page that is on both their access and the staff role", () => {
  assert.doesNotThrow(() => allowed_staff_pages(
    ["users", "purchaseOrders", "receiving"],
    ["purchaseOrders", "receiving", "suppliers"],
    ["purchaseOrders"],
  ));
});

test("a role name becomes a unique slug and keeps the company suffix in reserve", () => {
  assert.equal(staff_role_slug("Warehouse Staff"), "warehouse_staff");
  const company = "2df8d1d8-5eff-4cb4-9da9-c23e254e5a94";
  assert.deepEqual(staff_role_slug_candidates("Warehouse Staff", company)?.slice(0, 2), ["warehouse_staff", "warehouse_staff_2df8d1d8"]);
});

test("checked staff actions stay within the supervisor grant", () => {
  assert.deepEqual(selected_staff_permissions(
    ["users", "purchaseOrders"],
    [
      { permission: "users.view", scope: "company", companyId: "company-a" },
      { permission: "purchaseOrders.view", scope: "company", companyId: "company-a" },
      { permission: "purchaseOrders.add", scope: "own", companyId: "company-a" },
    ],
    "company-a",
    ["purchaseOrders"],
    ["purchaseOrders.view"],
    { "purchaseOrders.view": "own" },
  ), {
    pages: ["purchaseOrders"],
    permissions: [{ permission_key: "purchaseOrders.view", access_scope: "own" }],
  });
  assert.throws(() => selected_staff_permissions(
    ["purchaseOrders"],
    [{ permission: "purchaseOrders.view", scope: "own", companyId: "company-a" }],
    "company-a",
    ["purchaseOrders"],
    ["purchaseOrders.view"],
    { "purchaseOrders.view": "all" },
  ), UserError);
  assert.throws(() => selected_staff_permissions(
    ["purchaseOrders"],
    [{ permission: "purchaseOrders.view", scope: "all", companyId: "company-a" }],
    "company-a",
    ["purchaseOrders"],
    ["purchaseOrders.view"],
    { "purchaseOrders.view": "all" },
  ), UserError);
});

test("a supervisor cannot grant Users or a page outside the staff role", () => {
  assert.throws(() => parse_page_keys(["users"]), UserError);
  assert.throws(() => allowed_staff_pages(["purchaseOrders"], ["receiving"], ["receiving"]), UserError);
  assert.throws(() => allowed_staff_pages(["purchaseOrders"], ["purchaseOrders"], ["suppliers"]), UserError);
});
