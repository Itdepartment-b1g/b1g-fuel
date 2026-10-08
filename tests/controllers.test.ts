import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, RequestHandler, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import * as rolesService from "../src/server/services/roles_service";
import * as companiesService from "../src/server/services/companies_service";
import * as usersService from "../src/server/services/users_service";
import { authService } from "../src/server/services/auth_service";
import * as rolesRepository from "../src/server/repositories/roles_repository";
import * as companiesRepository from "../src/server/repositories/companies_repository";
import { list_role as listRoleController, create_role as createRoleController, edit_role as editRoleController, update_role as updateRoleController, delete_role as deleteRoleController } from "../src/server/controllers/roles_controller";
import { list_company as listCompanyController, create_company as createCompanyController, edit_company as editCompanyController, update_company as updateCompanyController, delete_company as deleteCompanyController } from "../src/server/controllers/companies_controller";
import { list_user as listUserController, create_user as createUserController } from "../src/server/controllers/users_controller";
import { get_user_session } from "../src/server/controllers/auth_controller";
import { create_google_controller } from "../src/server/controllers/google_auth_controller";
import { RoleError, CompanyError, UserError } from "../src/server/utils/errors";
import type { RoleSummary } from "../src/server/schema/roles_schema";
import type { CompanySummary } from "../src/server/schema/companies_schema";
import type { UserSummary } from "../src/server/schema/users_schema";

const roleService = { ...rolesService };
const list_role: RequestHandler = (req, res, next) => listRoleController(req, res, next, roleService);
const create_role: RequestHandler = (req, res, next) => createRoleController(req, res, next, roleService);
const edit_role: RequestHandler = (req, res, next) => editRoleController(req, res, next, roleService);
const update_role: RequestHandler = (req, res, next) => updateRoleController(req, res, next, roleService);
const delete_role: RequestHandler = (req, res, next) => deleteRoleController(req, res, next, roleService);

const companyService = { ...companiesService };
const list_company: RequestHandler = (req, res, next) => listCompanyController(req, res, next, companyService);
const create_company: RequestHandler = (req, res, next) => createCompanyController(req, res, next, companyService);
const edit_company: RequestHandler = (req, res, next) => editCompanyController(req, res, next, companyService);
const update_company: RequestHandler = (req, res, next) => updateCompanyController(req, res, next, companyService);
const delete_company: RequestHandler = (req, res, next) => deleteCompanyController(req, res, next, companyService);

const userService = { ...usersService };
const list_user: RequestHandler = (req, res, next) => listUserController(req, res, next, userService);
const create_user: RequestHandler = (req, res, next) => createUserController(req, res, next, userService);

const id = "11111111-1111-4111-8111-111111111111";
const role: RoleSummary = { id, name: "Manager", slug: "manager", scope: "company", is_system: false, is_default_role: false, pages: [], permissions: [], assignment_count: 0, created_at: "2026-10-07T00:00:00Z", updated_at: "2026-10-07T00:00:00Z" };
const company: CompanySummary = { id, name: "Manila", member_count: 0, created_at: role.created_at, updated_at: role.updated_at };
const user: UserSummary = { id, name: "Juan", email: "juan@example.com", created_at: role.created_at, companies: [], global_roles: [] };
const request = { query: { id }, body: { id, name: "Updated" } } as unknown as Request;
async function invoke(handler: RequestHandler, req = request) {
  let status = 0; let body: unknown;
  const res = { locals: {}, status(value: number) { status = value; return this; }, json(value: unknown) { body = value; return this; } } as unknown as Response;
  await handler(req, res, () => assert.fail("Resource controller should handle its response"));
  return { status, body };
}

test("controllers explicitly return 200 for reads/updates/deletion and 201 for creation", async t => {
  const query = { query: {} } as Request;
  t.mock.method(roleService, "list_role", async () => ({ roles: [role], total: 1, page: 1, page_size: 10 }));
  t.mock.method(roleService, "create_role", async () => role);
  t.mock.method(roleService, "edit_role", async () => role);
  t.mock.method(roleService, "update_role", async () => role);
  t.mock.method(roleService, "delete_role", async () => ({ id, message: "Role deleted." }));
  t.mock.method(companyService, "list_company", async () => ({ companies: [company], total: 1, page: 1, page_size: 10 }));
  t.mock.method(companyService, "create_company", async () => company);
  t.mock.method(companyService, "edit_company", async () => company);
  t.mock.method(companyService, "update_company", async () => company);
  t.mock.method(companyService, "delete_company", async () => ({ id, message: "Company deleted." }));
  t.mock.method(userService, "list_user", async () => ({ users: [user], total: 1, page: 1, page_size: 10 }));
  t.mock.method(userService, "create_user", async () => user);
  for (const handler of [list_role, list_company, list_user]) assert.equal((await invoke(handler, query)).status, 200);
  for (const handler of [edit_role, update_role, delete_role, edit_company, update_company, delete_company]) assert.equal((await invoke(handler)).status, 200);
  const createRequest = { query: {}, body: { name: "Manager" } } as Request;
  assert.deepEqual(await invoke(create_role, createRequest), { status: 201, body: { role } });
  assert.deepEqual(await invoke(create_company, createRequest), { status: 201, body: { company } });
  assert.deepEqual(await invoke(create_user, { body: { name: user.name, email: user.email, password: "test-password" } } as Request), { status: 201, body: { user } });
});

test("services report business reasons and controllers translate missing/protected/conflicting records", async t => {
  const repository = { ...rolesRepository, list_by_id_role: async () => null };
  t.mock.method(roleService, "edit_role", (roleId: string) => rolesService.edit_role(roleId, repository));
  const companyRepository = { ...companiesRepository, list_by_id_company: async () => null };
  t.mock.method(companyService, "edit_company", (companyId: string) => companiesService.edit_company(companyId, companyRepository));
  await assert.rejects(roleService.edit_role(id), error => error instanceof RoleError && error.code === "role_not_found" && !("status" in error));
  assert.deepEqual(await invoke(edit_role), { status: 404, body: { error: "Role not found." } });
  assert.deepEqual(await invoke(edit_company), { status: 404, body: { error: "Company not found." } });
  const protectedRole = await invoke(create_role, { body: { name: "Super Admin", slug: "super_admin" } } as Request);
  assert.equal(protectedRole.status, 403);
  t.mock.method(companyService, "delete_company", async () => { throw new CompanyError("company_has_members", "Company has members."); });
  assert.deepEqual(await invoke(delete_company), { status: 409, body: { error: "Company has members." } });
  t.mock.method(userService, "create_user", async () => { throw new UserError("email_exists", "Email already exists."); });
  assert.equal((await invoke(create_user, { body: { name: "Juan", email: user.email, password: "test-password" } } as Request)).status, 409);
});

test("controllers map wrapped database conflicts and return a safe 500 for unexpected failures", async t => {
  t.mock.method(console, "error", () => {});
  const fault = new Error("private SQL, account details, and parameters");
  t.mock.method(roleService, "list_role", async () => { throw fault; });
  t.mock.method(companyService, "list_company", async () => { throw fault; });
  t.mock.method(userService, "list_user", async () => { throw fault; });
  t.mock.method(authService, "get_user_session", async () => { throw fault; });
  for (const handler of [list_role, list_company, list_user, get_user_session]) {
    assert.deepEqual(await invoke(handler, { query: {} } as Request), { status: 500, body: { error: "The request could not be completed." } });
  }
  t.mock.method(roleService, "create_role", async () => { throw { cause: { code: "23505", detail: "private SQL" } }; });
  const conflict = await invoke(create_role, { body: { name: "Manager" } } as Request);
  assert.equal(conflict.status, 409); assert.equal(JSON.stringify(conflict.body).includes("private SQL"), false);
  t.mock.method(userService, "create_user", async () => { throw { cause: { code: "23503", detail: "private constraint" } }; });
  const invalid = await invoke(create_user, { body: { name: "Juan", email: user.email, password: "test-password" } } as Request);
  assert.equal(invalid.status, 400); assert.equal(JSON.stringify(invalid.body).includes("private constraint"), false);
});

test("Google initiation translates provider failure into 502 in the controller", async t => {
  const auth = createClient("http://localhost:56321", "test-key").auth;
  t.mock.method(auth, "signInWithOAuth", async () => { throw new Error("private provider failure"); });
  const handlers = create_google_controller({ auth_client: () => auth });
  assert.deepEqual(await invoke(handlers.start_google_login), { status: 502, body: { error: "Unable to start Google sign-in. Please try again." } });
});
