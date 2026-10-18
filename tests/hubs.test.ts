import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";
import { canPerform, type RecordAccess } from "@/lib/auth/access-scope";
import { PERMISSION_CATALOG } from "@/lib/auth/permissions";
import { PAGE_CATALOG } from "@/lib/auth/catalog";
import { openapi } from "@/lib/openapi/openapi";
import { record_where, requirePermission } from "@/server/auth/record-access";
import * as controller from "@/server/controllers/hubs_controller";
import { hub_company, hub_assignment_access } from "@/server/services/hubs_service";

const company = "10000000-0000-4000-8000-000000000001";
const otherCompany = "10000000-0000-4000-8000-000000000002";
const actor = "20000000-0000-4000-8000-000000000001";
const hubId = "30000000-0000-4000-8000-000000000001";
const access: RecordAccess = {
  userId: actor, superAdmin: false, companyIds: [company, otherCompany], pages: ["hubs"],
  grants: ["view", "add", "edit", "delete"].map((action) => ({ permission: `hubs.${action}`, scope: "company", companyId: company })),
};

function response(scope = access) {
  const state = { status: 0, body: undefined as unknown };
  const res = {
    locals: { access: scope },
    status: (value: number) => { state.status = value; return res; },
    json: (value: unknown) => { state.body = value; return res; },
  };
  return { res: res as unknown as Response, state };
}

test("hub company selection follows creation grants, including explicit cross-company rejection", () => {
  assert.equal(hub_company(access), company);
  assert.throws(() => hub_company(access, otherCompany), /cannot create hubs in this company/);
  assert.throws(() => hub_company({ ...access, grants: [] }), /cannot create hubs/);
  const several = { ...access, grants: [...access.grants, { permission: "hubs.add", scope: "company" as const, companyId: otherCompany }] };
  assert.throws(() => hub_company(several), /Select a company/);
  assert.equal(hub_company(several, otherCompany), otherCompany);
  assert.throws(() => hub_company({ ...access, superAdmin: true }), /Select a company/);
  assert.equal(hub_company({ ...access, superAdmin: true }, otherCompany), otherCompany);
  assert.equal(hub_company({ ...access, companyIds: [], grants: [{ permission: "hubs.add", scope: "all", companyId: null }] }, company), company);
});

test("own hub access follows assignments inside the grant company, never created_by", () => {
  const own: RecordAccess = { ...access, grants: [{ permission: "hubs.view", scope: "own", companyId: company }] };
  assert.deepEqual(record_where(own, "hubs"), {
    OR: [{ company_id: { in: [company] }, users: { some: { membership: { user_id: actor } } } }],
  });
  const record = { id: hubId, company_id: company, created_by: "someone-else", assigned_user_ids: [actor] };
  assert.equal(canPerform(own, "hubs", "view", record), true);
  assert.equal(canPerform(own, "hubs", "view", { ...record, created_by: actor, assigned_user_ids: [] }), false);
  assert.equal(canPerform(own, "hubs", "view", { ...record, company_id: otherCompany }), false);
  assert.equal(canPerform({ ...own, grants: [] }, "hubs", "view", record), false);
});

test("staff assignment management requires company-level edit access and never broadens grants", () => {
  assert.deepEqual(hub_assignment_access(access).grants, [access.grants[2]]);
  assert.throws(() => hub_assignment_access({
    ...access, grants: [{ permission: "hubs.edit", scope: "own", companyId: company }],
  }), /Company-level hub edit permission/);
  assert.throws(() => hub_assignment_access({ ...access, grants: [] }), /Company-level hub edit permission/);
});

test("hub middleware rejects missing action permissions", () => {
  assert.deepEqual(record_where({ ...access, grants: [] }, "hubs"), { id: { in: [] } });
  const { res, state } = response({ ...access, grants: [] });
  let continued = false;
  requirePermission("hubs", "add")({} as Request, res, () => { continued = true; });
  assert.equal(state.status, 403);
  assert.equal(continued, false);
});

test("invalid hub input returns 400 before database access, including forged audit and ownership fields", async () => {
  const cases: Array<[typeof controller.create_hub, unknown]> = [
    [controller.create_hub, undefined], [controller.create_hub, []], [controller.create_hub, { name: " " }],
    [controller.create_hub, { name: "a".repeat(161) }], [controller.create_hub, { name: "Hub", address: null }],
    [controller.create_hub, { name: "Hub", company_id: null }], [controller.create_hub, { name: "Hub", created_by: actor }],
    [controller.create_hub, { name: "Hub", type: "warehouse" }], [controller.create_hub, { name: "Hub", is_active: false }],
    [controller.update_hub, { id: hubId }], [controller.update_hub, { id: hubId, company_id: otherCompany }],
    [controller.update_hub, { id: hubId, created_by: actor }], [controller.update_hub, { id: hubId, name: "" }],
    [controller.update_hub, { id: hubId, is_active: "true" }], [controller.update_hub, { id: "invalid", name: "Hub" }],
    [controller.assign_hub, { location_id: hubId, user_company_id: "invalid" }],
    [controller.assign_hub, { location_id: hubId, user_company_id: actor, assigned_by: actor }],
  ];
  for (const [handler, body] of cases) {
    const { res, state } = response();
    await handler({ body } as Request, res);
    assert.equal(state.status, 400, JSON.stringify(body));
  }
});

test("invalid hub queries, sorting, and pagination return 400", async () => {
  const cases: Array<[typeof controller.list_hub, object]> = [
    [controller.list_hub, { company_id: ["invalid"] }], [controller.list_hub, { is_active: "yes" }],
    [controller.list_hub, { search: ["a", "b"] }], [controller.list_hub, { page: "0" }],
    [controller.list_hub, { page_size: "13" }], [controller.list_hub, { sort_by: "created_by" }],
    [controller.list_hub, { filters: "invalid-json" }],
    [controller.list_by_id_hub, { id: ["invalid"] }], [controller.delete_hub, {}],
    [controller.list_hub_assignment, { location_id: "invalid" }], [controller.unassign_hub, { location_id: hubId }],
    [controller.list_hub_assignment, { location_id: hubId, search: ["invalid"] }],
    [controller.list_hub_assignment, { location_id: hubId, search: "a".repeat(161) }],
    [controller.get_hub_assignment_option, { location_id: hubId, search: [] }],
  ];
  for (const [handler, query] of cases) {
    const { res, state } = response();
    await handler({ query } as Request, res);
    assert.equal(state.status, 400, JSON.stringify(query));
  }
});

test("hub permissions, navigation, and API contracts are registered", () => {
  assert.notEqual(PAGE_CATALOG.find((page) => page.key === "hubs")?.navigation, false);
  for (const action of ["view", "add", "edit", "delete"])
    assert.ok(PERMISSION_CATALOG.some((permission) => permission.key === `hubs.${action}`));
  assert.ok(openapi.paths["/api/hubs"]);
  assert.ok(openapi.paths["/api/hubs/assignments"]);
  assert.ok(openapi.paths["/api/hubs/assignment-options"]);
  assert.ok(openapi.paths["/api/hubs/filter-options"]);
  assert.ok(openapi.components.schemas.HubQuickFilters);
  assert.ok(openapi.components.schemas.Hub);
});
