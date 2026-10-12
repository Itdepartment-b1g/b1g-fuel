import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { compareTableValues, sortTableRows } from "../src/lib/table";
import { DataTable } from "../src/components/common/data-table";
import { makeStore } from "../src/lib/store/store";
import { listUser } from "../src/lib/store/users-slice";
import { listCompany } from "../src/lib/store/companies-slice";
import { listRole } from "../src/lib/store/roles-slice";

test("local sorting handles text, numbers, dates and missing values without mutating rows", () => {
  assert.ok(compareTableValues("Item 2", "Item 10", "asc") < 0);
  assert.ok(compareTableValues(2, 10, "desc") > 0);
  assert.ok(compareTableValues(new Date("2026-10-12"), new Date("2026-10-10"), "desc") < 0);
  for (const direction of ["asc", "desc"] as const) {
    for (const missing of [null, undefined, NaN, new Date("invalid")])
      assert.equal(compareTableValues(missing, 1, direction), 1);
  }
  const rows = Object.freeze([{ id: "b", value: 2 }, { id: "a", value: 2 }, { id: "c", value: null }]);
  const result = sortTableRows(rows, { field: "value", direction: "desc" }, row => row.value, row => row.id);
  assert.deepEqual(result.map(row => row.id), ["a", "b", "c"]);
  assert.equal(rows[0].id, "b");
  assert.deepEqual(sortTableRows(rows, { field: "value", direction: "asc" }, row => row.value, row => row.id,
    (a, b) => b.id.localeCompare(a.id)).map(row => row.id), ["c", "b", "a"]);
});

test("table defaults to latest-created ordering and leaves server pages in their supplied order", () => {
  const rows = [{ id: "old", name: "Old row", created_at: "2026-10-10T00:00:00Z" }, { id: "new", name: "New row", created_at: "2026-10-12T00:00:00Z" }];
  const props = { data: rows, columns: [{ id: "name", header: "Name", value: (row: typeof rows[number]) => row.name }], rowKey: (row: typeof rows[number]) => row.id, caption: "Test rows" };
  const local = renderToStaticMarkup(createElement(DataTable<typeof rows[number]>, props));
  assert.ok(local.indexOf("New row") < local.indexOf("Old row"));
  const remote = renderToStaticMarkup(createElement(DataTable<typeof rows[number]>, { ...props, sortingMode: "server" }));
  assert.ok(remote.indexOf("Old row") < remote.indexOf("New row"));
  const empty = renderToStaticMarkup(createElement(DataTable<typeof rows[number]>, { ...props, data: [] }));
  assert.match(empty, /No records found/);
  const loading = renderToStaticMarkup(createElement(DataTable<typeof rows[number]>, { ...props, data: [], loading: true }));
  assert.match(loading, /Loading records/);
  assert.doesNotMatch(loading, /No records found/);
});

test("all list thunks send table sorting to the API and omit it when returning to default", async (t) => {
  const urls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
    urls.push(String(url));
    return new Response(JSON.stringify({ users: [], companies: [], roles: [], total: 0, page: 1, page_size: 10 }));
  });
  const store = makeStore();
  const requests = [
    (query: { sort_by?: string; sort_order?: "asc" | "desc" }) => store.dispatch(listUser(query)).unwrap(),
    (query: { sort_by?: string; sort_order?: "asc" | "desc" }) => store.dispatch(listCompany(query)).unwrap(),
    (query: { sort_by?: string; sort_order?: "asc" | "desc" }) => store.dispatch(listRole(query)).unwrap(),
  ];
  for (const request of requests) {
    await request({ sort_by: "name", sort_order: "asc" });
    const sorted = new URL(urls.at(-1)!, "http://localhost");
    assert.equal(sorted.searchParams.get("sort_by"), "name");
    assert.equal(sorted.searchParams.get("sort_order"), "asc");
    await request({});
    assert.equal(new URL(urls.at(-1)!, "http://localhost").searchParams.has("sort_by"), false);
  }
});
