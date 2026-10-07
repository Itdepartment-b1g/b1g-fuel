import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response as ExpressResponse } from "express";
import { validateCreateRole, validateUpdateRole } from "../src/server/controllers/roles_controller";
import { RoleError } from "../src/server/utils/errors";
import { roleService } from "../src/server/services/roles_service";
import { rolesRepository } from "../src/server/repositories/roles_repository";
import { createRole as createController, listRole as listRoleController, editRole as editRoleController, deleteRole as deleteController } from "../src/server/controllers/roles_controller";
import { makeStore } from "../src/lib/store/store";
import { listRole, editRole, getRoleOption, createRole, updateRole, deleteRole, resetRoles } from "../src/lib/store/roles-slice";
import type { RoleSummary } from "../src/lib/roles";

const id = "11111111-1111-4111-8111-111111111111";
const role: RoleSummary = { id, name: "Manager", slug: "manager", scope: "company", is_system: false, is_default_role: false, created_at: "2026-10-07T00:00:00.000Z", updated_at: "2026-10-07T00:00:00.000Z", pages: ["users"], permissions: ["users.view"], assignment_count: 0 };
const page = { roles: [role], total: 1, page: 1, page_size: 10 };
function response() {
  let status = 200; let body: unknown;
  const res = { status(code: number) { status = code; return this; }, json(value: unknown) { body = value; } } as unknown as ExpressResponse;
  return { res, result: () => ({ status, body }) };
}

test("role input supports defaults and rejects system fields, unknown mappings and invalid defaults", () => {
  assert.deepEqual(validateCreateRole({ name: " Branch Manager " }), { name: "Branch Manager", slug: "branch_manager", scope: "company", is_default_role: false, pages: [], permissions: [] });
  assert.equal(validateCreateRole({ name: "Manager", slug: " MANAGER " }).slug, "manager");
  for (const body of [null, [], { name: "" }, { name: "x".repeat(101) }, { name: "Manager", is_system: true }, { name: "Manager", slug: "bad slug" }, { name: "Manager", scope: "bad" }, { name: "Manager", is_default_role: "true" }, { name: "Manager", pages: ["not_registered"] }, { name: "Manager", pages: ["users", "users"] }, { name: "Manager", permissions: ["unregistered.delete"] }]) {
    assert.throws(() => validateCreateRole(body), RoleError);
  }
  assert.deepEqual(validateUpdateRole({ id, pages: [], permissions: [] }), { id, pages: [], permissions: [] });
  for (const body of [{ id }, { id, slug: "new_slug" }, { id, scope: "global" }, { id, is_system: false }, { id: "bad", name: "Manager" }]) assert.throws(() => validateUpdateRole(body), RoleError);
});

test("controllers validate list filters and translate conflicts without exposing database errors", async (t) => {
  const list = t.mock.method(rolesRepository, "listRole", async () => page);
  const find = t.mock.method(rolesRepository, "getRole", async () => role);
  const { res, result } = response();
  await listRoleController({ query: { page: "2", page_size: "20", search: " manager ", scope: "company" } } as unknown as Request, res, () => {});
  assert.deepEqual(list.mock.calls[0].arguments, [{ page: 2, page_size: 20, skip: 20, take: 20 }, "manager", "company"]);
  await editRoleController({ query: { id } } as unknown as Request, res, () => {});
  assert.deepEqual(find.mock.calls[0].arguments, [id]);
  for (const query of [{ page_size: "15" }, { scope: "bad" }, { search: ["a", "b"] }]) {
    await listRoleController({ query } as unknown as Request, res, () => {}); assert.equal(result().status, 400);
  }
  t.mock.method(rolesRepository, "createRole", async () => { throw { code: "P2002", secret: "database details" }; });
  await createController({ body: { name: "Manager" } } as Request, res, () => {});
  assert.equal(result().status, 409); assert.equal(JSON.stringify(result()).includes("database details"), false);
  t.mock.method(roleService, "deleteRole", async () => { throw { code: "P2003" }; });
  await deleteController({ query: { id } } as unknown as Request, res, () => {});
  assert.equal(result().status, 409);
});

test("service guards system roles and global defaults before writing; mappings can be cleared atomically", async (t) => {
  const holder = globalThis as typeof globalThis & { prisma?: unknown }; const previous = holder.prisma;
  t.after(() => { if (previous === undefined) delete holder.prisma; else holder.prisma = previous; });
  let system = true; let scope = "company";
  const update = t.mock.fn(async () => ({ count: 1 })); const remove = t.mock.fn(async () => ({ count: 1 }));
  const deletePages = t.mock.fn(async () => ({ count: 1 })); const deletePermissions = t.mock.fn(async () => ({ count: 1 }));
  const createPages = t.mock.fn(async () => ({ count: 1 })); const createPermissions = t.mock.fn(async () => ({ count: 1 }));
  const raw = { ...role, created_at: new Date(role.created_at), updated_at: new Date(role.updated_at), pages: [], permissions: [], _count: { user_roles: 0, company_roles: 0 } };
  const tx = {
    roles: { findUnique: async () => ({ ...raw, is_system: system, scope }), updateMany: update, deleteMany: remove, findUniqueOrThrow: async () => raw },
    role_pages: { deleteMany: deletePages, createMany: createPages }, role_permissions: { deleteMany: deletePermissions, createMany: createPermissions },
  };
  holder.prisma = { $transaction: async (run: (transaction: typeof tx) => Promise<unknown>) => run(tx) };
  await assert.rejects(roleService.updateRole({ id, name: "New" }), (error) => error instanceof RoleError && error.status === 403);
  await assert.rejects(roleService.deleteRole(id), (error) => error instanceof RoleError && error.status === 403);
  assert.equal(update.mock.callCount(), 0); assert.equal(remove.mock.callCount(), 0);
  system = false; scope = "global";
  await assert.rejects(roleService.updateRole({ id, is_default_role: true }), (error) => error instanceof RoleError && error.status === 400);
  scope = "company";
  const changed = await roleService.updateRole({ id, pages: [], permissions: [] });
  assert.deepEqual(changed.pages, []); assert.deepEqual(changed.permissions, []);
  assert.equal(deletePages.mock.callCount(), 1); assert.equal(deletePermissions.mock.callCount(), 1);
  assert.equal(createPages.mock.callCount(), 0); assert.equal(createPermissions.mock.callCount(), 0);
  raw._count.company_roles = 1;
  await assert.rejects(roleService.deleteRole(id), (error) => error instanceof RoleError && error.status === 409);
  assert.equal(remove.mock.callCount(), 0);
});

test("service rejects reserved slugs and global defaults before creating records", (t) => {
  const create = t.mock.method(rolesRepository, "createRole", async () => role);
  assert.throws(() => roleService.createRole(validateCreateRole({ name: "Super Admin", slug: "super_admin" })), (error) => error instanceof RoleError && error.status === 403);
  assert.throws(() => roleService.createRole(validateCreateRole({ name: "Global", scope: "global", is_default_role: true })), (error) => error instanceof RoleError && error.status === 400);
  assert.equal(create.mock.callCount(), 0);
});

test("Redux role requests use cookies and mutations invalidate stale lists", async (t) => {
  const store = makeStore();
  const fetch = t.mock.method(globalThis, "fetch", async (_url: string | URL | Request, init?: RequestInit) => new Response(JSON.stringify(init?.method === "DELETE" ? { id, message: "Role deleted." } : { role }), { status: 200 }));
  assert.deepEqual(await store.dispatch(createRole({ name: "Manager" })).unwrap(), { role });
  const args = fetch.mock.calls[0].arguments as unknown as [string, RequestInit];
  assert.equal(args[1].credentials, "include"); assert.equal(args[1].method, "POST");
  await store.dispatch(editRole(id)).unwrap();
  await store.dispatch(updateRole({ id, name: "Manager" })).unwrap();
  assert.deepEqual(store.getState().roles.selectedRole, role);
  store.dispatch(listRole.pending("old", undefined));
  await store.dispatch(deleteRole(id)).unwrap();
  store.dispatch(listRole.fulfilled(page, "old", undefined));
  assert.equal(store.getState().roles.roles.length, 0); assert.equal(store.getState().roles.selectedRole, null);
  fetch.mock.mockImplementation(async () => new Response(JSON.stringify({ error: "Super-admin access is required." }), { status: 403 }));
  await assert.rejects(store.dispatch(listRole()).unwrap());
  assert.equal(store.getState().roles.listError?.status, 403);
  await assert.rejects(store.dispatch(getRoleOption()).unwrap());
  assert.equal(store.getState().roles.optionsError?.status, 403);
});

test("Redux prevents concurrent mutations and ignores late results after reset", async (t) => {
  const store = makeStore(); let resolve!: (response: Response) => void;
  const fetch = t.mock.method(globalThis, "fetch", async () => new Promise<Response>((done) => { resolve = done; }));
  const pending = store.dispatch(createRole({ name: "Manager" }));
  await assert.rejects(store.dispatch(deleteRole(id)).unwrap()); assert.equal(fetch.mock.callCount(), 1);
  store.dispatch(resetRoles()); resolve(new Response(JSON.stringify({ role })));
  await pending;
  assert.equal(store.getState().roles.mutationStatus, "idle"); assert.equal(store.getState().roles.lastChangedRole, null);
});
