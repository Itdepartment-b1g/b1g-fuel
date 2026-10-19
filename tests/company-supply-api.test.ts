import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import type { Request, Response } from "express";
import { closeDatabase, getDatabase, type Database } from "@/server/lib/database";
import type { RecordAccess } from "@/lib/auth/access-scope";
import * as controller from "@/server/controllers/company_supply_controller";
import type { CompanySupplyRecord } from "@/server/schema/company_supply_schema";
import { companySupplyReducer, listCompanySupply, createCompanySupply } from "@/lib/store/company-supply-slice";

const url = process.env.DATABASE_URL;
const local = url && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(url).hostname);
const admin: RecordAccess = { userId: randomUUID(), superAdmin: true, companyIds: [], pages: [], grants: [] };

async function request(handler: (req: Request, res: Response) => Promise<void>, access: RecordAccess, body?: unknown, query: object = {}) {
  const state = { status: 0, body: undefined as unknown };
  const res = { locals: { access }, status(value: number) { state.status = value; return res; }, json(value: unknown) { state.body = value; return res; } };
  await handler({ body, query } as Request, res as unknown as Response);
  return state;
}

test("supply setup denies ordinary users and rejects forged audit fields", async () => {
  const ordinary = { ...admin, superAdmin: false, grants: [{ permission: "companies.edit", scope: "all" as const, companyId: null }] };
  const pair = { requesting_company_id: randomUUID(), supplying_company_id: randomUUID() };
  assert.equal((await request(controller.create_company_supply, ordinary, pair)).status, 403);
  assert.equal((await request(controller.update_company_supply, ordinary, { id: randomUUID(), is_active: false })).status, 403);
  for (const handler of [controller.list_company_supply, controller.get_company_supply_option])
    assert.equal((await request(handler, ordinary, undefined, { company_id: pair.requesting_company_id })).status, 403);
  assert.equal((await request(controller.create_company_supply, admin, { ...pair, created_by: randomUUID() })).status, 400);
  assert.equal((await request(controller.update_company_supply, admin, { id: randomUUID(), is_active: false, ...pair })).status, 400);
  assert.equal((await request(controller.list_company_supply, admin, undefined, { company_id: pair.requesting_company_id, page_size: "1000" })).status, 400);
});

test("Redux ignores stale reads and invalidates in-flight reads after a write", () => {
  const query = { company_id: randomUUID(), direction: "requesting" as const };
  const page = { relationships: [], total: 0, page: 1, page_size: 10 };
  let state = companySupplyReducer(undefined, listCompanySupply.pending("old", query));
  state = companySupplyReducer(state, listCompanySupply.pending("new", { ...query, page: 2 }));
  state = companySupplyReducer(state, listCompanySupply.fulfilled(page, "old", query));
  assert.equal(state.page, null);
  assert.equal(state.listRequestId, "new");
  const pair = { requesting_company_id: query.company_id, supplying_company_id: randomUUID() };
  state = companySupplyReducer(state, createCompanySupply.pending("write", pair));
  state = companySupplyReducer(state, createCompanySupply.fulfilled({ relationship: {} as CompanySupplyRecord }, "write", pair));
  state = companySupplyReducer(state, listCompanySupply.fulfilled(page, "new", query));
  assert.equal(state.page, null);
  assert.equal(state.listStatus, "idle");
});

test("supply API supports many requesters, directional options, immutable history and reactivation", { skip: !local }, async () => {
  const database = getDatabase();
  const globalState = globalThis as typeof globalThis & { fuelDatabase?: { database: Database } };
  const original = globalState.fuelDatabase;
  const rollback = new Error("Rollback supply API fixtures");
  try {
    await assert.rejects(database.$transaction(async (tx) => {
      globalState.fuelDatabase = { database: new Proxy(tx, { get(target, key) {
        if (key === "$transaction") return async (run: (client: typeof tx) => unknown) => run(tx);
        return Reflect.get(target, key);
      } }) as unknown as Database };
      await tx.user.create({ data: { id: admin.userId, name: "Supply administrator" } });
      const [a, b, c, d] = Array.from({ length: 4 }, () => randomUUID());
      for (const [id, name] of [[a, "A"], [b, "B"], [c, "C"], [d, "D"]])
        await tx.company.create({ data: { id, name: `Supply API ${name}` } });
      let first!: CompanySupplyRecord;
      for (const requester of [a, c, d]) {
        const result = await request(controller.create_company_supply, admin, { requesting_company_id: requester, supplying_company_id: b });
        assert.equal(result.status, 201);
        const link = (result.body as { relationship: CompanySupplyRecord }).relationship;
        assert.equal(link.created_by, admin.userId);
        assert.equal(link.created_by_name, "Supply administrator");
        if (requester === a) first = link;
      }
      const list = await request(controller.list_company_supply, admin, undefined, { company_id: b, direction: "supplying", search: "Supply API", page_size: "10" });
      assert.equal(list.status, 200);
      assert.equal((list.body as { total: number }).total, 3);
      const search = await request(controller.list_company_supply, admin, undefined, { company_id: b, direction: "supplying", search: "API C" });
      assert.equal((search.body as { total: number }).total, 1);
      const secondPage = await request(controller.list_company_supply, admin, undefined, { company_id: b, direction: "supplying", page: "2" });
      assert.deepEqual((secondPage.body as { relationships: unknown[] }).relationships, []);
      const deactivated = await request(controller.update_company_supply, admin, { id: first.id, is_active: false });
      const inactive = (deactivated.body as { relationship: CompanySupplyRecord }).relationship;
      assert.equal(inactive.created_at, first.created_at);
      assert.equal(inactive.created_by, first.created_by);
      assert.equal(inactive.is_active, false);
      const options = await request(controller.get_company_supply_option, admin, undefined, { company_id: a, search: "Supply API" });
      const ids = (options.body as { companies: { id: string }[] }).companies.map((company) => company.id);
      assert.ok(!ids.includes(a) && !ids.includes(b));
      assert.ok(ids.includes(c));
      await tx.$executeRawUnsafe("SAVEPOINT duplicate_link");
      assert.equal((await request(controller.create_company_supply, admin, { requesting_company_id: a, supplying_company_id: b })).status, 409);
      await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT duplicate_link");
      assert.equal((await request(controller.create_company_supply, admin, { requesting_company_id: a, supplying_company_id: a })).status, 400);
      assert.equal((await request(controller.create_company_supply, admin, { requesting_company_id: b, supplying_company_id: a })).status, 201);
      const restored = await request(controller.update_company_supply, admin, { id: first.id, is_active: true });
      assert.equal((restored.body as { relationship: CompanySupplyRecord }).relationship.id, first.id);
      assert.equal((await request(controller.update_company_supply, admin, { id: randomUUID(), is_active: false })).status, 404);
      throw rollback;
    }, { timeout: 30_000 }), (error) => error === rollback);
  } finally {
    globalState.fuelDatabase = original;
    await closeDatabase();
  }
});
