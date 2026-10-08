import { mockDatabase } from "./database-fixture";
import assert from "node:assert/strict";
import { test } from "node:test";
import { create_company as createController, update_company as updateController } from "../src/server/controllers/companies_controller";
import type { Request, Response as ExpressResponse } from "express";
import { CompanyError } from "../src/server/services/companies_service";
import * as companyService from "../src/server/services/companies_service";
import * as companiesRepository from "../src/server/repositories/companies_repository";
import { makeStore } from "../src/lib/store/store";
import { createCompany, deleteCompany, listCompany, resetCompanies } from "../src/lib/store/companies-slice";
import type { CompanySummary } from "../src/server/schema/companies_schema";

const id = "11111111-1111-4111-8111-111111111111";
const company: CompanySummary = { id, name: "Manila", created_at: "2026-10-07T00:00:00Z", updated_at: "2026-10-07T00:00:00Z", member_count: 0 };
test("company validation trims names and rejects missing, oversized or read-only fields", async (t) => {
  const service = { ...companyService };
  const create = t.mock.method(service, "create_company", async () => company);
  const update = t.mock.method(service, "update_company", async () => company);
  let status = 200;
  const res = { status(code: number) { status = code; return this; }, json() {} } as unknown as ExpressResponse;
  await createController({ body: { name: " Manila " } } as Request, res, undefined, service);
  assert.deepEqual(create.mock.calls[0].arguments[0], { name: "Manila" });
  await updateController({ body: { id, name: "Cebu" } } as Request, res, undefined, service);
  assert.deepEqual(update.mock.calls[0].arguments[0], { id, name: "Cebu" });
  for (const body of [null, [], {}, { name: "  " }, { name: "x".repeat(161) }, { name: "Manila", member_count: 0 }, { name: "Manila", id }]) {
    await createController({ body } as Request, res, undefined, service);
    assert.equal(status, 400);
  }
  await updateController({ body: { id: "bad", name: "Manila" } } as Request, res, undefined, service);
  assert.equal(status, 400);
  assert.equal(create.mock.callCount(), 1); assert.equal(update.mock.callCount(), 1);
});
test("company deletion checks membership after locking and preserves companies with members", async (t) => {
  mockDatabase(t, () => []);
  let members = 1; let removed = false; let locked = false;
  const repository: typeof companiesRepository = { ...companiesRepository,
    list_by_id_company: async (_id, _client, lock) => { locked = Boolean(lock); return { ...company, member_count: members }; },
    update_company: async () => company, delete_company: async () => { removed = true; },
  };
  await assert.rejects(companyService.delete_company(id, repository), (error) => error instanceof CompanyError && error.code === "company_has_members");
  assert.equal(locked, true); assert.equal(removed, false);
  members = 0;
  assert.deepEqual(await companyService.delete_company(id, repository), { id, message: "Company deleted." }); assert.equal(removed, true);
});
test("repository locks the company before reading membership counts in the same transaction", async (t) => {
  const queries = mockDatabase(t, ({ model, method }) => {
    if (model === "$queryRaw") return [{ id }];
    if (model === "company" && method === "findUnique") return { id, name: company.name, created_at: new Date(company.created_at), updated_at: new Date(company.updated_at), _count: { user_companies: 0 } };
    return null;
  });
  await companyService.delete_company(id);
  assert.equal(queries[0].method, "begin");
  assert.equal(queries[1].model, "$queryRaw");
  assert.ok(String(queries[1].args.sql).endsWith("for update"));
  assert.equal(queries[2].method, "findUnique");
  assert.deepEqual(queries[2].args.include, { _count: { select: { user_companies: true } } });
  assert.equal(queries[3].method, "delete");
  assert.equal(queries[4].method, "commit");
  assert.deepEqual(queries[1].args.values, [id]);
});
test("company Redux mutations preserve errors and invalidate stale responses", async (t) => {
  const store = makeStore();
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ company })));
  store.dispatch(listCompany.pending("old", undefined));
  await store.dispatch(createCompany({ name: company.name })).unwrap();
  const args = fetch.mock.calls[0].arguments as unknown as [string, RequestInit]; assert.equal(args[1].credentials, "include");
  store.dispatch(listCompany.fulfilled({ companies: [company], total: 1, page: 1, page_size: 10 }, "old", undefined));
  assert.equal(store.getState().companies.companies.length, 0);
  fetch.mock.mockImplementation(async () => new Response(JSON.stringify({ error: "This company has members." }), { status: 409 }));
  await assert.rejects(store.dispatch(deleteCompany(id)).unwrap()); assert.equal(store.getState().companies.mutationError?.status, 409);
  store.dispatch(resetCompanies()); assert.equal(store.getState().companies.mutationStatus, "idle");
});
