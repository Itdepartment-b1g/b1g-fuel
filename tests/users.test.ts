import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import type { Request, Response as ExpressResponse } from "express";
import { createUserService } from "../src/server/services/users_service";
import { validateCreateUser } from "../src/server/controllers/users_controller";
import { UserError } from "../src/server/utils/errors";
import { usersRepository } from "../src/server/repositories/users_repository";
import { authRepository } from "../src/server/repositories/auth_repository";
import { requireSuperAdmin } from "../src/server/auth/authorization";
import { listUser as listUserController } from "../src/server/controllers/users_controller";
import { getUserSession } from "../src/server/controllers/auth_controller";
import { makeStore } from "../src/lib/store/store";
import { createUser, listUser, getUserOption, resetUsers } from "../src/lib/store/users-slice";
import type { UserSummary } from "../src/lib/users";
import { configureStore, type Middleware } from "@reduxjs/toolkit";
import { usersReducer } from "../src/lib/store/users-slice";
import { authReducer } from "../src/lib/store/auth-slice";
import { rolesReducer } from "../src/lib/store/roles-slice";

const company = "11111111-1111-4111-8111-111111111111";
const role = "22222222-2222-4222-8222-222222222222";
const id = "33333333-3333-4333-8333-333333333333";
const input = { name: "Test User", email: "user@example.com", password: "secret-password123", company_id: company, role_ids: [role] };
const user: UserSummary = { id, name: input.name, email: input.email, created_at: "2026-10-07T00:00:00.000Z", global_roles: [], companies: [{ id: company, name: "Company", roles: [{ id: role, name: "Staff", slug: "staff" }] }] };
const authUser = { id } as User;
const page = { users: [user], total: 1, page: 1, page_size: 10 };

test("session uses the database name and falls back to Auth metadata for a missing profile", async (t) => {
  t.mock.method(authRepository, "listUserGlobalRole", async () => [{ role: { slug: "super_admin" } }]);
  const profile = t.mock.method(authRepository, "getUserProfile", async (): Promise<{ id: string; name: string; email: string | null } | null> => ({ id, name: "Database Name", email: input.email }));
  let result: unknown;
  const res = { locals: { user: { id, email: input.email, user_metadata: { full_name: " Metadata Name " } } }, json(body: unknown) { result = body; } } as unknown as ExpressResponse;
  await getUserSession({} as Request, res, (error) => { throw error; });
  assert.deepEqual(result, { user: { id, email: input.email, name: "Database Name" }, global_roles: ["super_admin"] });
  profile.mock.mockImplementation(async () => null);
  await getUserSession({} as Request, res, (error) => { throw error; });
  assert.deepEqual(result, { user: { id, email: input.email, name: "Metadata Name" }, global_roles: ["super_admin"] });
});

test("Redux sends the required name on creation and retains it in creation and list results", async (t) => {
  const store = makeStore();
  const fetch = t.mock.method(globalThis, "fetch", async (_url: string | URL | Request, init?: RequestInit) =>
    new Response(JSON.stringify(init?.method === "POST" ? { user } : page), { status: init?.method === "POST" ? 201 : 200 }));
  const created = await store.dispatch(createUser(input));
  assert.equal(JSON.parse(String(fetch.mock.calls[0].arguments[1]?.body)).name, input.name);
  assert.equal(created.name, input.name);
  assert.equal(store.getState().users.lastCreated?.name, input.name);
  await store.dispatch(listUser({ search: "Test User" })).unwrap();
  assert.equal(store.getState().users.users[0].name, input.name);
  assert.equal(String(fetch.mock.calls[1].arguments[0]), "/api/users?search=Test+User");
});

test("creation validates and normalizes input; rejects privilege fields and malformed assignments", () => {
  assert.equal(validateCreateUser({ ...input, email: " USER@EXAMPLE.COM " }).email, input.email);
  assert.equal(validateCreateUser({ ...input, name: " Test User " }).name, input.name);
  for (const name of [undefined, null, "", "   ", "x".repeat(251)]) {
    assert.throws(() => validateCreateUser({ ...input, name }), (error) => error instanceof UserError && error.status === 400);
  }
  for (const body of [null, [], { ...input, password: "short" }, { ...input, role_ids: [role, role] }, { ...input, role_ids: null }, { ...input, company_id: null }, { ...input, company_id: "bad" }, { ...input, global_roles: ["super_admin"] }, { ...input, id }]) {
    assert.throws(() => validateCreateUser(body), (error) => error instanceof UserError && error.status === 400);
  }
});

test("creation accepts omitted assignments and company-only memberships; roles require a company", async () => {
  const minimal = { name: input.name, email: input.email, password: input.password };
  assert.deepEqual(validateCreateUser(minimal), { ...minimal, company_id: undefined, role_ids: [] });
  assert.deepEqual(validateCreateUser({ ...minimal, role_ids: [] }).role_ids, []);
  assert.deepEqual(validateCreateUser({ ...minimal, company_id: company }).role_ids, []);
  await assert.rejects(createUserService().createUser(validateCreateUser({ ...minimal, role_ids: [role] })), (error) => error instanceof UserError && error.status === 400);
});

test("repository omits optional lookups and membership writes, but persists company-only memberships", async (t) => {
  const holder = globalThis as typeof globalThis & { prisma?: unknown };
  const previous = holder.prisma;
  t.after(() => { if (previous === undefined) delete holder.prisma; else holder.prisma = previous; });
  const raw = { id, name: input.name, email: input.email, created_at: new Date(user.created_at), user_roles: [], user_companies: [] };
  const create = t.mock.fn(async () => raw);
  const companyLookup = t.mock.fn(async () => ({ id: company }));
  const roleLookup = t.mock.fn(async () => 1);
  const tx = { user: { create } };
  holder.prisma = {
    user: { findFirst: t.mock.fn(async () => null) },
    company: { findUnique: companyLookup }, roles: { count: roleLookup },
    $transaction: async (run: (transaction: typeof tx) => Promise<unknown>) => run(tx),
  };
  const minimal = { name: input.name, email: input.email, password: input.password };
  assert.deepEqual(await usersRepository.getUserAssignment(minimal), { existingUser: null, company: null, roleCount: 0 });
  assert.equal(companyLookup.mock.callCount(), 0); assert.equal(roleLookup.mock.callCount(), 0);
  const created = await usersRepository.createUser(id, minimal);
  assert.deepEqual(created.companies, []);
  const noMembership = create.mock.calls[0].arguments as unknown as [{ data: Record<string, unknown> }];
  assert.equal("user_companies" in noMembership[0].data, false);
  assert.deepEqual(await usersRepository.getUserAssignment({ ...minimal, company_id: company }), { existingUser: null, company: { id: company }, roleCount: 0 });
  assert.equal(companyLookup.mock.callCount(), 1); assert.equal(roleLookup.mock.callCount(), 0);
  await usersRepository.createUser(id, { ...minimal, company_id: company });
  const membership = create.mock.calls[1].arguments as unknown as [{ data: { user_companies: { create: { company_id: string; roles: { create: unknown[] } } } } }];
  assert.equal(membership[0].data.user_companies.create.company_id, company);
  assert.deepEqual(membership[0].data.user_companies.create.roles.create, []);
});

test("Redux creates a user without company or role fields", async (t) => {
  const store = makeStore();
  const unassigned = { ...user, companies: [] };
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ user: unassigned }), { status: 201 }));
  const minimal = { name: input.name, email: input.email, password: input.password };
  assert.deepEqual(await store.dispatch(createUser(minimal)), unassigned);
  const args = fetch.mock.calls[0].arguments as unknown as [string, RequestInit];
  assert.deepEqual(JSON.parse(String(args[1].body)), minimal);
  assert.deepEqual(store.getState().users.lastCreated?.companies, []);
});

test("global role check denies ordinary users and permits super_admin", async (t) => {
  const lookup = t.mock.method(authRepository, "listUserGlobalRole", async (): Promise<{ role: { slug: string } }[]> => []);
  let status = 0; let allowed = false;
  const res = { locals: { user: { id } }, status(code: number) { status = code; return this; }, json() {} } as unknown as ExpressResponse;
  await requireSuperAdmin({} as Request, res, () => { allowed = true; });
  assert.equal(status, 403); assert.equal(allowed, false);
  lookup.mock.mockImplementation(async () => [{ role: { slug: "super_admin" } }]);
  await requireSuperAdmin({} as Request, res, () => { allowed = true; });
  assert.equal(allowed, true);
});

test("creation validates assignments before Auth; saves matching UUID and cleans up only newly created account on failure", async (t) => {
  const validate = t.mock.method(usersRepository, "getUserAssignment", async (): Promise<Awaited<ReturnType<typeof usersRepository.getUserAssignment>>> => ({ existingUser: null, company: null, roleCount: 0 }));
  const save = t.mock.method(usersRepository, "createUser", async () => user);
  const admin = createClient("http://localhost:56321", "test-key").auth.admin;
  const create = t.mock.method(admin, "createUser", async () => ({ data: { user: authUser }, error: null }));
  const remove = t.mock.method(admin, "deleteUser", async () => ({ data: { user: authUser }, error: null }));
  const service = createUserService(usersRepository, () => admin);
  await assert.rejects(service.createUser(input), (error) => error instanceof UserError && error.status === 400);
  assert.equal(create.mock.callCount(), 0);
  validate.mock.mockImplementation(async () => ({ existingUser: { id }, company: { id: company }, roleCount: 1 }));
  await assert.rejects(service.createUser(input), (error) => error instanceof UserError && error.status === 409);
  assert.equal(create.mock.callCount(), 0);
  validate.mock.mockImplementation(async () => ({ existingUser: null, company: { id: company }, roleCount: 1 }));
  assert.deepEqual(await service.createUser(input), user);
  assert.equal(save.mock.calls[0].arguments[0], id);
  assert.equal(save.mock.calls[0].arguments[1]?.name, input.name);
  assert.deepEqual(create.mock.calls[0].arguments[0]?.user_metadata, { full_name: input.name });
  assert.equal(remove.mock.callCount(), 0);
  save.mock.mockImplementation(async () => { throw { code: "P2002" }; });
  await assert.rejects(service.createUser(input), (error) => Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002"));
  assert.equal(remove.mock.calls[0].arguments[0], id);
  save.mock.mockImplementation(async () => { throw new Error("database failure"); });
  remove.mock.mockImplementation(async () => { throw new Error("cleanup failed"); });
  const log = t.mock.method(console, "error", () => {});
  await assert.rejects(service.createUser(input), /database failure/);
  assert.equal(log.mock.callCount(), 1);
  assert.equal(JSON.stringify(log.mock.calls).includes(input.password), false);
});

test("Auth duplicates do not write profiles or delete existing accounts", async (t) => {
  t.mock.method(usersRepository, "getUserAssignment", async () => ({ existingUser: null, company: { id: company }, roleCount: 1 }));
  const save = t.mock.method(usersRepository, "createUser", async () => user);
  const admin = createClient("http://localhost:56321", "test-key").auth.admin;
  t.mock.method(admin, "createUser", async () => ({ data: { user: null }, error: { code: "email_exists" } }));
  const remove = t.mock.method(admin, "deleteUser", async () => ({ data: { user: authUser }, error: null }));
  await assert.rejects(createUserService(usersRepository, () => admin).createUser(input), (error) => error instanceof UserError && error.status === 409);
  assert.equal(save.mock.callCount(), 0); assert.equal(remove.mock.callCount(), 0);
});

test("listing validates pagination before repository access", async (t) => {
  const list = t.mock.method(usersRepository, "listUser", async () => page);
  let status = 200; let result: unknown;
  const res = { status(code: number) { status = code; return this; }, json(body: unknown) { result = body; } } as unknown as ExpressResponse;
  for (const query of [{ page: "0" }, { page_size: "101" }, { page: ["1", "2"] }, { search: {} }]) {
    await listUserController({ query } as unknown as Request, res, (error) => { throw error; });
    assert.equal(status, 400);
  }
  assert.equal(list.mock.callCount(), 0);
  await listUserController({ query: { page: "2", page_size: "10", search: " user " } } as unknown as Request, res, (error) => { throw error; });
  assert.deepEqual(list.mock.calls[0].arguments, [{ page: 2, page_size: 10, skip: 10, take: 10 }, { AND: [{ OR: [{ name: { contains: "user", mode: "insensitive" } }, { email: { contains: "user", mode: "insensitive" } }] }, {}] }]); assert.deepEqual(result, page);
});

test("Redux handles API errors, stale reads and resets", async (t) => {
  const store = makeStore();
  assert.equal(store.getState().users.page_size, 10);
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ error: "Sign in to continue." }), { status: 401 }));
  await store.dispatch(listUser({ search: "user" }));
  assert.equal(store.getState().users.listError?.status, 401);
  await store.dispatch(getUserOption());
  assert.equal(store.getState().users.optionsError?.status, 401);
  store.dispatch(listUser.pending("old", undefined));
  store.dispatch(listUser.pending("new", undefined));
  store.dispatch(listUser.fulfilled(page, "old", undefined));
  assert.equal(store.getState().users.listStatus, "loading");
  store.dispatch(listUser.fulfilled(page, "new", undefined));
  assert.deepEqual(store.getState().users.users, [user]);
  store.dispatch(resetUsers());
  store.dispatch(listUser.fulfilled(page, "new", undefined));
  assert.equal(store.getState().users.users.length, 0);
});

test("Redux creation keeps passwords out of actions/state, prevents parallel creation and invalidates old reads", async (t) => {
  const actions: unknown[] = [];
  const recorder: Middleware = () => (next) => (action) => { actions.push(action); return next(action); };
  const store = configureStore({ reducer: { users: usersReducer, auth: authReducer, roles: rolesReducer }, middleware: (getDefault) => getDefault().concat(recorder) });
  let resolve!: (response: Response) => void;
  const fetch = t.mock.method(globalThis, "fetch", async () => new Promise<Response>((done) => { resolve = done; }));
  store.dispatch(listUser.pending("old", undefined));
  const pending = store.dispatch(createUser(input));
  await assert.rejects(store.dispatch(createUser(input)));
  assert.equal(fetch.mock.callCount(), 1);
  resolve(new Response(JSON.stringify({ user }), { status: 201 }));
  assert.deepEqual(await pending, user);
  assert.equal(store.getState().users.createStatus, "succeeded");
  store.dispatch(listUser.fulfilled(page, "old", undefined));
  assert.equal(store.getState().users.users.length, 0);
  assert.equal(JSON.stringify(actions).includes(input.password), false);
  assert.equal(JSON.stringify(store.getState()).includes(input.password), false);
  const second = store.dispatch(createUser(input));
  store.dispatch(resetUsers());
  resolve(new Response(JSON.stringify({ user }), { status: 201 }));
  await second;
  assert.equal(store.getState().users.lastCreated, null);
  fetch.mock.mockImplementation(async () => new Response(JSON.stringify({ error: "Already exists" }), { status: 409 }));
  await assert.rejects(store.dispatch(createUser(input)));
  assert.equal(store.getState().users.createError?.status, 409);
});
