import assert from "node:assert/strict";
import { test } from "node:test";
import { canPerform, type RecordAccess } from "@/lib/auth/access-scope";
import { allowed_company_ids, membership_page_keys, record_where, requirePermission } from "@/server/auth/record-access";
import type { Request, Response } from "express";

const access: RecordAccess = {
  userId: "creator", superAdmin: false, companyIds: ["company-a", "company-b"], pages: ["users", "companies"],
  grants: [
    { permission: "users.view", scope: "company", companyId: "company-a" },
    { permission: "users.add", scope: "company", companyId: "company-a" },
    { permission: "companies.edit", scope: "own", companyId: "company-a" },
  ],
};

test("My company uses the role's company, rather than all memberships", () => {
  assert.deepEqual(record_where(access, "users"), { OR: [{ user_companies: { some: { company_id: { in: ["company-a"] } } } }] });
  assert.deepEqual(allowed_company_ids(access, "users"), ["company-a"]);
});

test("Only me matches created_by rather than the target user's ID", () => {
  assert.deepEqual(record_where(access, "companies", "edit"), { OR: [{ created_by: "creator" }] });
  assert.equal(canPerform(access, "companies", "edit", { id: "another", created_by: "creator" }), true);
  assert.equal(canPerform(access, "companies", "edit", { id: "creator", created_by: "another" }), false);
  assert.equal(canPerform(access, "companies", "edit", { id: "creator", created_by: null }), false);
});

test("missing grants deny access; super-admins retain full access", () => {
  assert.deepEqual(record_where(access, "roles"), { OR: [] });
  assert.equal(canPerform(access, "roles", "edit"), false);
  assert.deepEqual(record_where({ ...access, superAdmin: true }, "roles"), {});
  assert.equal(canPerform({ ...access, superAdmin: true }, "roles", "edit"), true);
});

test("global All grants cover all records and scoped grants combine with OR", () => {
  const global = { ...access, grants: [{ permission: "users.view", scope: "all" as const, companyId: null }] };
  assert.deepEqual(record_where(global, "users"), {});
  const own = { ...access, grants: [...access.grants, { permission: "users.view", scope: "own" as const, companyId: "company-a" }] };
  assert.equal(record_where(own, "users").OR?.length, 2);
});

test("assigned pages keep the overlap with the role", () => {
  assert.deepEqual(membership_page_keys("role_pages", ["users", "purchaseOrders"], []), ["users", "purchaseOrders"]);
  assert.deepEqual(membership_page_keys("assigned_pages", ["users", "purchaseOrders", "receiving"], ["purchaseOrders"]), ["purchaseOrders"]);
  assert.deepEqual(membership_page_keys("assigned_pages", ["purchaseOrders"], []), []);
});

test("HTTP permission middleware rejects disabled actions", () => {
  let status = 0;
  let continued = false;
  const res = { locals: { access }, status: (value: number) => { status = value; return res; }, json: () => res } as unknown as Response;
  requirePermission("users", "delete")({} as Request, res, () => { continued = true; });
  assert.equal(status, 403);
  assert.equal(continued, false);
  requirePermission("users", "add")({} as Request, res, () => { continued = true; });
  assert.equal(continued, true);
});
