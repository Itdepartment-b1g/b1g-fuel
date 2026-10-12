import { mockDatabase } from "./database-fixture";
import assert from "node:assert/strict";
import { test } from "node:test";
import { addCondition, changeConditionField, countActiveFilters, createQuickFilterState, removeCondition, searchFilterOptions, type QuickFilterState } from "../src/lib/quick-filter";
import { filterRecords, groupActiveConditions, matchesColumnConditions, matchesDate, resolveDateRange } from "../src/server/lib/filter";
import { USER_FILTER_DEFAULTS } from "../src/lib/users-filters";
import { list_user as listUserController } from "../src/server/controllers/users_controller";
import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import * as userService from "../src/server/services/users_service";
import { makeStore } from "../src/lib/store/store";
import { listUser } from "../src/lib/store/users-slice";

const defaults = { status: "all", additional: { membership: "all" } };
const rows = [
  { department: "Sales", location: "Manila", status: "active", membership: "yes", created_at: "2026-10-07T02:00:00Z" },
  { department: "Support", location: "Manila", status: "active", membership: "no", created_at: "2026-10-07T01:00:00Z" },
  { department: "Sales", location: "Cebu", status: "active", membership: "yes", created_at: "2026-10-06T01:00:00Z" },
  { department: "Finance", location: "Manila", status: "inactive", membership: "yes", created_at: "2026-10-07T01:00:00Z" },
];
const match = (row: typeof rows[number], field: string, value: string) => String(row[field as keyof typeof row]).toLowerCase() === value.toLowerCase();
test("nonadjacent same-field conditions use OR, different fields use AND, and incomplete rows are ignored", () => {
  const conditions = [
    { id: "a", field: "department", value: " Sales " }, { id: "b", field: "location", value: "Manila" },
    { id: "c", field: "department", value: "Support" }, { id: "d", field: "", value: "Finance" }, { id: "e", field: "location", value: "  " },
  ];
  assert.deepEqual([...groupActiveConditions(conditions)], [["department", ["Sales", "Support"]], ["location", ["Manila"]]]);
  assert.deepEqual(rows.filter((row) => matchesColumnConditions(row, conditions, match)), rows.slice(0, 2));
  assert.ok(rows.every((row) => matchesColumnConditions(row, [], match)));
});
test("condition helpers inherit fields, clear values on field changes and retain an empty row", () => {
  const empty = createQuickFilterState(defaults);
  assert.equal(empty.conditions.length, 1); assert.equal(addCondition(empty.conditions).length, 1);
  const active = [{ id: "first", field: "department", value: "Sales" }];
  const added = addCondition(active);
  assert.equal(added.length, 2); assert.equal(added[1].field, "department"); assert.equal(added[1].value, ""); assert.notEqual(added[1].id, active[0].id);
  assert.equal(changeConditionField(active, "first", "location")[0].value, "");
  const removed = removeCondition(active, "first"); assert.equal(removed.length, 1); assert.equal(removed[0].field, "");
});
test("counts include every active row and date/status/additional choices; option search checks labels and values", () => {
  const state = createQuickFilterState(defaults);
  state.conditions = [{ id: "a", field: "department", value: "Sales" }, { id: "b", field: "department", value: "Sales" }, { id: "c", field: "location", value: " " }];
  state.date.preset = "today"; state.status = "active"; state.additional.membership = "yes";
  assert.equal(countActiveFilters(state, defaults), 5);
  assert.equal(countActiveFilters(createQuickFilterState(defaults), defaults), 0);
  const options = [{ label: "Sales team", value: "dept-001", count: 2 }, { label: "Support", value: "dept-002" }];
  assert.deepEqual(searchFilterOptions(options, " SALES "), [options[0]]);
  assert.deepEqual(searchFilterOptions(options, "002"), [options[1]]);
  assert.deepEqual(searchFilterOptions(options, "missing"), []);
});
test("column, date, status and extra filters combine with AND", () => {
  const state = createQuickFilterState(defaults);
  state.conditions = [{ id: "a", field: "location", value: "Manila" }]; state.date.preset = "today"; state.status = "active"; state.additional.membership = "yes";
  assert.deepEqual(filterRecords(rows, state, { defaults, match, matchDate: (row, date) => matchesDate(row.created_at, date, new Date("2026-10-07T05:00:00Z")), matchStatus: (row, value) => row.status === value, matchAdditional: (row, key, value) => String(row[key as keyof typeof row]) === value }), [rows[0]]);
});
test("Manila dates are inclusive calendar days with open-ended custom ranges and validated bounds", () => {
  const today = resolveDateRange({ preset: "today", from: "", to: "" }, new Date("2026-10-06T18:00:00Z"));
  assert.equal(today.from?.toISOString(), "2026-10-06T16:00:00.000Z"); assert.equal(today.toExclusive?.toISOString(), "2026-10-07T16:00:00.000Z");
  const range = { preset: "custom", from: "2026-10-07", to: "2026-10-07" };
  assert.ok(matchesDate("2026-10-07T15:59:59Z", range)); assert.equal(matchesDate("2026-10-07T16:00:00Z", range), false);
  assert.ok(matchesDate("2030-01-01T00:00:00Z", { preset: "custom", from: "2026-10-07", to: "" }));
  assert.throws(() => resolveDateRange({ preset: "custom", from: "2026-02-31", to: "" }), RangeError);
  assert.throws(() => resolveDateRange({ preset: "custom", from: "2026-10-08", to: "2026-10-07" }), RangeError);
});
test("users filtering validates input and translates groups before database pagination", async (t) => {
  const queries = mockDatabase(t, ({ method }) => method === "count" ? 0 : []);
  const state = createQuickFilterState(USER_FILTER_DEFAULTS);
  state.conditions = [{ id: "a", field: "name", value: " Juan " }, { id: "b", field: "email", value: "juan@example.com" }, { id: "c", field: "name", value: "Aaron" }];
  const service = { ...userService };
  const list = t.mock.method(service, "list_user", async () => ({ users: [], total: 0, page: 1, page_size: 10 }));
  let status = 200;
  const res = { status(code: number) { status = code; return this; }, json() {} } as unknown as ExpressResponse;
  await listUserController({ query: { filters: JSON.stringify(state) } } as unknown as ExpressRequest, res, undefined, service);
  await userService.list_user({ page: 1, page_size: 10, skip: 0, take: 10 }, "", list.mock.calls[0].arguments[2]);
  const query = queries.find(query => query.method === "findMany")!.args.where;
  assert.deepEqual(query, { AND: [
    { OR: [{ name: { equals: "Juan", mode: "insensitive" } }, { name: { equals: "Aaron", mode: "insensitive" } }] },
    { OR: [{ email: { equals: "juan@example.com", mode: "insensitive" } }] },
  ] });
  for (const invalid of [{ ...state, status: "invalid" }, { ...state, conditions: [] }, { ...state, conditions: [{ id: "a", field: "sql", value: "x" }] }, { ...state, conditions: [state.conditions[0], state.conditions[0]] }, { ...state, additional: { unknown: "yes" } }]) {
    await listUserController({ query: { filters: JSON.stringify(invalid) } } as unknown as ExpressRequest, res, undefined, service);
    assert.equal(status, 400);
  }
  assert.equal(list.mock.callCount(), 1);
  const cleared: QuickFilterState = createQuickFilterState(USER_FILTER_DEFAULTS);
  await userService.list_user({ page: 1, page_size: 10, skip: 0, take: 10 }, "", cleared);
  assert.deepEqual(queries.filter(query => query.method === "findMany").at(-1)!.args.where, {});
});

test("user rows and total share the same database filter before skip/take", async (t) => {
  const queries = mockDatabase(t, ({ method }) => method === "count" ? 12 : []);
  const filters = createQuickFilterState(USER_FILTER_DEFAULTS);
  filters.conditions[0] = { id: "a", field: "name", value: "Juan" };
  const result = await userService.list_user({ page: 2, page_size: 10, skip: 10, take: 10 }, "juan", filters);
  const rowQuery = queries.find(query => query.method === "findMany")!;
  const countQuery = queries.find(query => query.method === "count")!;
  assert.deepEqual(rowQuery.args.where, countQuery.args.where);
  assert.equal(rowQuery.args.skip, 10); assert.equal(rowQuery.args.take, 10);
  assert.deepEqual(queries[0].args, { isolationLevel: "RepeatableRead" });
  assert.equal(queries.at(-1)?.method, "commit");
  assert.equal(result.total, 12); assert.equal(result.page, 2);
});

test("Redux sends structured filters alongside pagination and text search", async (t) => {
  const store = makeStore(); const filters = createQuickFilterState(USER_FILTER_DEFAULTS);
  filters.conditions[0] = { id: "a", field: "email", value: "person@example.com" };
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ users: [], total: 0, page: 1, page_size: 10 })));
  await store.dispatch(listUser({ page: 1, page_size: 10, search: "person", filters })).unwrap();
  const args = fetch.mock.calls[0].arguments as unknown as [string, RequestInit];
  const url = new URL(args[0], "http://localhost");
  assert.deepEqual(JSON.parse(url.searchParams.get("filters")!), filters);
  assert.equal(url.searchParams.get("search"), "person"); assert.equal(args[1].credentials, "include");
});
