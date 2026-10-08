import { mockDatabase } from "./database-fixture";
import assert from "node:assert/strict";
import { test } from "node:test";
import { validate_create_company, validate_update_company } from "../src/server/utils/companies_request";
import { CompanyError } from "../src/server/utils/errors";
import * as companyService from "../src/server/services/companies_service";
import * as companiesRepository from "../src/server/repositories/companies_repository";
import { makeStore } from "../src/lib/store/store";
import { createCompany, deleteCompany, listCompany, resetCompanies } from "../src/lib/store/companies-slice";
import type { CompanySummary } from "../src/server/schema/companies_schema";

const id = "11111111-1111-4111-8111-111111111111";
const company: CompanySummary = { id, name: "Manila", created_at: "2026-10-07T00:00:00Z", updated_at: "2026-10-07T00:00:00Z", member_count: 0 };
test("company validation trims names and rejects missing, oversized or read-only fields", () => {
  assert.deepEqual(validate_create_company({ name: " Manila " }), { name: "Manila" });
  assert.deepEqual(validate_update_company({ id, name: "Cebu" }), { id, name: "Cebu" });
  for (const input of [null, [], {}, { name: "  " }, { name: "x".repeat(161) }, { name: "Manila", member_count: 0 }, { name: "Manila", id }]) assert.throws(() => validate_create_company(input), CompanyError);
  assert.throws(() => validate_update_company({ id: "bad", name: "Manila" }), CompanyError);
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
  const queries = mockDatabase(t, ({ sql }) => {
    if (sql.includes('for update')) return [[id]];
    if (sql.startsWith('select')) return [[id, company.name, company.created_at, company.updated_at, 0]];
    return [];
  });
  await companyService.delete_company(id);
  assert.ok(queries[0].sql.startsWith("begin"));
  assert.ok(queries[1].sql.endsWith("for update"));
  assert.ok(queries[2].sql.includes("count(*)"));
  assert.ok(queries[2].sql.includes('"user_company"."company_id" = "company"."id"'));
  assert.ok(queries[3].sql.startsWith('delete from "company"'));
  assert.equal(queries[4].sql, "commit");
  assert.deepEqual(queries[1].params, [id]);
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
