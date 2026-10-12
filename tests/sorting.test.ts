import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";
import type { Prisma } from "../src/generated/prisma/client";
import { mockDatabase } from "./database-fixture";
import { build_sort, parse_sort, SortingError } from "../src/server/lib/sorting";
import * as users from "../src/server/repositories/users_repository";
import * as companies from "../src/server/repositories/companies_repository";
import * as roles from "../src/server/repositories/roles_repository";
import { list_user } from "../src/server/controllers/users_controller";
import { list_company } from "../src/server/controllers/companies_controller";
import { list_role } from "../src/server/controllers/roles_controller";

test("sorting preserves defaults and rejects malformed query parameters", () => {
  const fields = ["name", "created_at", "id"];
  assert.equal(parse_sort({}, fields), undefined);
  assert.deepEqual(parse_sort({ sort_by: "name" }, fields), { field: "name", direction: "asc" });
  assert.deepEqual(parse_sort({ sort_order: "asc" }, fields), { field: "created_at", direction: "asc" });
  for (const sort_by of ["", "unknown", ["name"], {}, null, 1])
    assert.throws(() => parse_sort({ sort_by }, fields), SortingError);
  for (const sort_order of ["", "ASC", ["asc"], {}, null, 1])
    assert.throws(() => parse_sort({ sort_by: "name", sort_order }, fields), SortingError);
});

test("sorting appends the unique tie-breaker once and never uses inherited field handlers", () => {
  const config = {
    fields: { name: (direction: "asc" | "desc") => ({ name: direction }), id: (direction: "asc" | "desc") => ({ id: direction }) },
    default: { field: "name", direction: "asc" as const },
    tieBreaker: { field: "id", order: { id: "asc" as const } },
  };
  assert.deepEqual(build_sort<Prisma.userOrderByWithRelationInput>(undefined, config), [{ name: "asc" }, { id: "asc" }]);
  assert.deepEqual(build_sort<Prisma.userOrderByWithRelationInput>({ field: "id", direction: "desc" }, config), [{ id: "desc" }]);
  assert.throws(() => build_sort<Prisma.userOrderByWithRelationInput>({ field: "constructor", direction: "asc" }, config), SortingError);
});

test("all list repositories sort in the database before slicing without changing total filters", async (t) => {
  const queries = mockDatabase(t, ({ method }) => method === "count" ? 30 : []);
  const pagination = { page: 2, page_size: 10, skip: 10, take: 10 };
  const sort = { field: "name", direction: "asc" as const };
  await users.list_user(pagination, "", undefined, sort);
  await companies.list_company(pagination, "", sort);
  await roles.list_role(pagination, "", "company", sort);
  for (const query of queries.filter(query => query.method === "findMany")) {
    assert.deepEqual(query.args.orderBy, [{ name: "asc" }, { id: "asc" }]);
    assert.equal(query.args.skip, 10);
    assert.equal(query.args.take, 10);
    assert.deepEqual(query.args.where, queries.find(other => other.model === query.model && other.method === "count")!.args.where);
  }
  await users.list_user(pagination, "");
  assert.deepEqual(queries.filter(query => query.method === "findMany").at(-1)!.args.orderBy, [{ created_at: "desc" }, { id: "asc" }]);
});

test("list controllers reject unknown sorting before accessing the database", async () => {
  for (const handler of [list_user, list_company, list_role]) {
    let status = 0;
    const res = { status(code: number) { status = code; return this; }, json() {} } as unknown as Response;
    await handler({ query: { sort_by: "password" } } as unknown as Request, res);
    assert.equal(status, 400);
  }
});

test("list controllers pass validated sorting through their services to Prisma", async (t) => {
  const queries = mockDatabase(t, ({ method }) => method === "count" ? 0 : []);
  for (const handler of [list_user, list_company, list_role]) {
    let status = 0;
    const res = { status(code: number) { status = code; return this; }, json() {} } as unknown as Response;
    await handler({ query: { sort_by: "name", sort_order: "desc" } } as unknown as Request, res);
    assert.equal(status, 200);
  }
  const rowQueries = queries.filter(query => query.method === "findMany");
  assert.equal(rowQueries.length, 3);
  for (const query of rowQueries)
    assert.deepEqual(query.args.orderBy, [{ name: "desc" }, { id: "asc" }]);
});
