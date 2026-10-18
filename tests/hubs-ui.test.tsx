import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { makeStore } from "@/lib/store/store";
import { assignHub, assignHubStaff, clearHubMutation, createHub, deactivateHub, editHub, getHubAssignmentOption, getHubFilterOption, getHubOption, listHub, listHubAssignment, unassignHub, updateHub } from "@/lib/store/hubs-slice";
import { ToastProvider } from "@/components/providers/toast-provider";
import { CreateHubFields } from "@/components/hubs/dialog/create-hub-dialog";
import { EditHubFields } from "@/components/hubs/dialog/edit-hub-dialog";
import { HubsTableView } from "@/components/hubs/table-view/hubs-table-view";
import { HubsCards } from "@/components/hubs/card-views/hubs-cards";
import { HubDetails } from "@/components/hubs/hub-details";
import { HubStaffChoices } from "@/components/hubs/dialog/assign-hub-dialog";
import { listSidebarMenu } from "@/app/layout/sideBarMenuItems";
import { canManageHubStaff } from "@/utils/hub-access";
import { HUB_FILTER_DEFAULTS, HUB_FILTER_OPTIONS } from "@/utils/hubs-filters";
import { createQuickFilterState } from "@/utils/quick-filter";
import type { HubSummary, HubAssignment } from "@/types/hubs";
import type { RecordAccess } from "@/lib/auth/access-scope";

test("staff choices show checkbox chips with names and emails and preserve selections from other pages", () => {
  const members = [
    { user_company_id: "aaron", user: { id: "aaron", name: "Aaron", email: "aaron@gmail.com" }, roles: [{ id: "agent", name: "Agent" }] },
    { user_company_id: "ben", user: { id: "ben", name: "Ben", email: null }, roles: [] },
  ];
  const selected = [members[0], { user_company_id: "other-page", user: { id: "other", name: "Other", email: null }, roles: [] }];
  const html = renderToStaticMarkup(<HubStaffChoices members={members} selected={selected} disabled={false} onChange={() => {}} />);
  assert.match(html, /Staff\/Agent/);
  assert.equal((html.match(/type="checkbox"/g) ?? []).length, 2);
  assert.equal((html.match(/ checked=""/g) ?? []).length, 1);
  assert.match(html, /Aaron/);
  assert.match(html, /text-xs[^"]*">\(Agent\)/);
  assert.match(html, /\(No role\)/);
  assert.match(html, / - aaron@gmail.com/);
  assert.match(html, /Ben/);
  assert.doesNotMatch(html, /<select|null|undefined/);
  const saving = renderToStaticMarkup(<HubStaffChoices members={members} selected={selected} disabled onChange={() => {}} />);
  assert.match(saving, /<fieldset[^>]*disabled/);
});

test("assigning selected staff deduplicates IDs and keeps the mutation pending for the whole save", async () => {
  const original = globalThis.fetch;
  const sent: string[] = [];
  const store = makeStore();
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(store.getState().hubs.mutationStatus, "loading");
    assert.equal(init?.credentials, "include");
    sent.push(body.user_company_id);
    return new Response(JSON.stringify({ assignment: { ...assignment, user_company_id: body.user_company_id } }));
  };
  try {
    const result = await store.dispatch(assignHubStaff({ location_id: hub.id, user_company_ids: ["first", "second", "first"] })).unwrap();
    assert.deepEqual(sent, ["first", "second"]);
    assert.equal(result.assignments.length, 2);
    assert.equal(store.getState().hubs.mutationStatus, "succeeded");
  } finally { globalThis.fetch = original; }
});

test("a partial staff assignment failure reports completed IDs and leaves the rest available for retry", async () => {
  const original = globalThis.fetch;
  const sent: string[] = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    sent.push(body.user_company_id);
    if (body.user_company_id === "second")
      return new Response(JSON.stringify({ error: "Could not assign this staff member." }), { status: 409 });
    return new Response(JSON.stringify({ assignment: { ...assignment, user_company_id: body.user_company_id } }));
  };
  try {
    const store = makeStore();
    store.dispatch(listHub.pending("stale", {}));
    const result = await store.dispatch(assignHubStaff({ location_id: hub.id, user_company_ids: ["first", "second", "third"] }));
    assert.ok(assignHubStaff.rejected.match(result));
    assert.deepEqual(result.payload?.assigned_user_company_ids, ["first"]);
    assert.equal(result.payload?.status, 409);
    assert.deepEqual(sent, ["first", "second"]);
    store.dispatch(listHub.fulfilled(page, "stale", {}));
    assert.deepEqual(store.getState().hubs.hubs, []);
    assert.equal(store.getState().hubs.mutationStatus, "failed");
    const selectedIds = ["first", "second", "third"].filter((id) => !result.payload?.assigned_user_company_ids?.includes(id));
    assert.deepEqual(selectedIds, ["second", "third"]);
  } finally { globalThis.fetch = original; }
});

const hub: HubSummary = {
  id: "30000000-0000-4000-8000-000000000001",
  company_id: "30000000-0000-4000-8000-000000000002",
  company: { id: "30000000-0000-4000-8000-000000000002", name: "B1G Fuel" },
  type: "hub", name: "North Hub", address: "North road", is_active: true,
  created_by: "creator", created_by_name: "Ada", staff_count: 1, assigned_user_ids: ["agent"],
  created_at: "2026-10-18T00:00:00Z", updated_at: "2026-10-18T00:00:00Z",
};
const page = { hubs: [hub], total: 1, page: 1, page_size: 10 };
const query = { location_id: hub.id, page: 1 };
const input = { location_id: hub.id, user_company_id: "membership" };
const assignment: HubAssignment = {
  ...input, id: "assignment", user: { id: "agent", name: "Agent", email: null },
  roles: [{ id: "agent-role", name: "Agent" }],
  assigned_by: "creator", assigned_by_name: "Ada", assigned_at: hub.created_at,
};
const roster = { assignments: [assignment], total: 1, page: 1, page_size: 10 };

test("Redux ignores old hub details, list responses, and staff results from another hub", () => {
  const store = makeStore();
  store.dispatch(listHub.pending("old", {}));
  store.dispatch(listHub.pending("new", { search: "North" }));
  store.dispatch(listHub.fulfilled(page, "old", {}));
  assert.deepEqual(store.getState().hubs.hubs, []);
  store.dispatch(listHub.fulfilled(page, "new", { search: "North" }));
  assert.equal(store.getState().hubs.total, 1);
  store.dispatch(editHub.pending("old-detail", "old"));
  store.dispatch(editHub.pending("new-detail", hub.id));
  store.dispatch(editHub.fulfilled({ hub }, "old-detail", "old"));
  assert.equal(store.getState().hubs.selectedHub, null);
  store.dispatch(listHubAssignment.pending("old-roster", { location_id: "other" }));
  store.dispatch(listHubAssignment.pending("new-roster", query));
  store.dispatch(listHubAssignment.fulfilled(roster, "old-roster", { location_id: "other" }));
  assert.equal(store.getState().hubs.assignments, null);
  store.dispatch(listHubAssignment.fulfilled(roster, "new-roster", query));
  assert.equal(store.getState().hubs.assignmentsLocationId, hub.id);
  store.dispatch(getHubAssignmentOption.pending("old-options", { location_id: "other" }));
  store.dispatch(getHubAssignmentOption.pending("new-options", query));
  store.dispatch(getHubAssignmentOption.fulfilled({ members: [], total: 0, page: 1, page_size: 10 }, "old-options", { location_id: "other" }));
  assert.equal(store.getState().hubs.assignmentOptions, null);
});

test("assignment mutations invalidate in-flight reads and failures remain retryable", () => {
  const store = makeStore();
  store.dispatch(listHub.pending("read", {}));
  store.dispatch(listHubAssignment.pending("roster", query));
  store.dispatch(assignHub.pending("save", input));
  store.dispatch(assignHub.fulfilled({ assignment }, "save", input));
  store.dispatch(listHub.fulfilled(page, "read", {}));
  store.dispatch(listHubAssignment.fulfilled(roster, "roster", query));
  assert.deepEqual(store.getState().hubs.hubs, []);
  assert.equal(store.getState().hubs.assignments, null);
  assert.equal(store.getState().hubs.listStatus, "idle");
  store.dispatch(assignHub.pending("retry", input));
  store.dispatch(assignHub.rejected(null, "retry", input, { status: 409, message: "Hub is inactive" }));
  assert.equal(store.getState().hubs.mutationError?.status, 409);
  store.dispatch(clearHubMutation());
  assert.equal(store.getState().hubs.mutationStatus, "idle");
});

test("hub thunks use cookies, all API operations, and JSON-encoded filters", async () => {
  const original = globalThis.fetch;
  const calls: Array<{ url: URL; init?: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    const parsed = new URL(String(url), "http://test");
    calls.push({ url: parsed, init });
    const body = parsed.pathname.endsWith("/filter-options") ? HUB_FILTER_OPTIONS
      : parsed.pathname.endsWith("/assignment-options") ? { members: [], total: 0, page: 1, page_size: 10 }
      : parsed.pathname.endsWith("/assignments") ? init?.method === "POST" ? { assignment } : init?.method === "DELETE" ? { ...input, message: "Removed" } : roster
      : parsed.pathname.endsWith("/options") ? { companies: [hub.company] }
      : init?.method === "DELETE" ? { id: hub.id, message: "Hub deactivated." }
      : init?.method || parsed.searchParams.has("id") ? { hub } : page;
    return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
  };
  try {
    const store = makeStore();
    const filters = createQuickFilterState(HUB_FILTER_DEFAULTS);
    filters.status = "inactive";
    await store.dispatch(listHub({ search: "North & South", page: 2, is_active: false, filters })).unwrap();
    assert.equal(calls[0].url.searchParams.get("search"), "North & South");
    assert.equal(calls[0].url.searchParams.get("is_active"), "false");
    assert.deepEqual(JSON.parse(calls[0].url.searchParams.get("filters")!), filters);
    await store.dispatch(editHub(hub.id)).unwrap();
    await store.dispatch(getHubOption()).unwrap();
    await store.dispatch(getHubFilterOption()).unwrap();
    await store.dispatch(createHub({ name: hub.name, company_id: hub.company_id })).unwrap();
    await store.dispatch(updateHub({ id: hub.id, is_active: true })).unwrap();
    await store.dispatch(deactivateHub(hub.id)).unwrap();
    await store.dispatch(listHubAssignment({ ...query, page: 2, page_size: 20, search: "Agent & Staff" })).unwrap();
    await store.dispatch(getHubAssignmentOption({ ...query, search: "Agent & Staff" })).unwrap();
    await store.dispatch(assignHub(input)).unwrap();
    await store.dispatch(unassignHub(input)).unwrap();
    assert.ok(calls.every((call) => call.init?.credentials === "include"));
    assert.equal(calls[8].url.searchParams.get("search"), "Agent & Staff");
    assert.equal(calls[7].url.searchParams.get("search"), "Agent & Staff");
    assert.equal(calls[7].url.searchParams.get("page"), "2");
    assert.equal(calls[7].url.searchParams.get("page_size"), "20");
    assert.deepEqual(JSON.parse(String(calls[9].init?.body)), input);
    assert.equal(calls[10].init?.method, "DELETE");
    assert.equal(calls[10].url.searchParams.get("user_company_id"), input.user_company_id);
    assert.equal(calls[6].url.pathname, "/api/hubs");
    assert.equal(calls[6].init?.method, "DELETE");
  } finally { globalThis.fetch = original; }
});

test("duplicate mutation dispatches are suppressed and errors retain HTTP status", async () => {
  const original = globalThis.fetch;
  let finish!: (value: Response) => void;
  let requests = 0;
  globalThis.fetch = async () => { requests++; return new Promise<Response>((resolve) => { finish = resolve; }); };
  try {
    const store = makeStore();
    const first = store.dispatch(assignHub(input));
    const second = await store.dispatch(assignHub(input));
    assert.ok(assignHub.rejected.match(second) && second.meta.condition);
    assert.equal(requests, 1);
    finish(new Response(JSON.stringify({ error: "Not permitted" }), { status: 403 }));
    const result = await first;
    assert.ok(assignHub.rejected.match(result));
    assert.deepEqual(store.getState().hubs.mutationError, { status: 403, message: "Not permitted" });
  } finally { globalThis.fetch = original; }
});

test("create/edit forms show company ownership, editable status, and retryable failures", () => {
  const store = makeStore();
  store.dispatch(getHubOption.pending("options", undefined));
  store.dispatch(getHubOption.fulfilled({ companies: [hub.company] }, "options", undefined));
  const render = (children: React.ReactNode) => renderToStaticMarkup(<Provider store={store}><ToastProvider>{children}</ToastProvider></Provider>);
  const create = render(<CreateHubFields onSaved={() => {}} onCancel={() => {}} />);
  assert.match(create, /B1G Fuel/);
  assert.match(create, /Hub name/);
  assert.match(create, /Address/);
  assert.match(create, /Create hub/);
  assert.doesNotMatch(create, /created_by|name="company_id"/);
  store.dispatch(updateHub.pending("save", { id: hub.id }));
  store.dispatch(updateHub.rejected(null, "save", { id: hub.id }, { status: 409, message: "Duplicate hub name" }));
  const edit = render(<EditHubFields hub={hub} onSaved={() => {}} onCancel={() => {}} />);
  assert.match(edit, /North Hub/);
  assert.match(edit, /Duplicate hub name/);
  assert.match(edit, /Save changes/);
  assert.match(edit, /Inactive/);
});

test("table, cards, and details show the same hub facts", () => {
  const callbacks = { onEdit: () => {}, onDeactivate: () => {}, onAssign: () => {}, disabled: false };
  const table = renderToStaticMarkup(<HubsTableView hubs={[hub]} loading={false} sorting={null} onSortingChange={() => {}} {...callbacks} />);
  const cards = renderToStaticMarkup(<HubsCards hubs={[hub]} {...callbacks} />);
  const details = renderToStaticMarkup(<HubDetails hub={hub} />);
  for (const html of [table, cards]) {
    for (const value of ["North Hub", "B1G Fuel", "North road", "Ada", "Active"]) assert.ok(html.includes(value));
  }
  assert.match(details, /Assigned staff/);
  assert.match(cards, /View hub/);
  assert.match(table, /Created by/);
});

test("staff assignment actions match backend company-level edit requirements and navigation follows grants", () => {
  const access: RecordAccess = { userId: "agent", superAdmin: false, pages: ["hubs"], companyIds: [hub.company_id], grants: [
    { permission: "hubs.edit", scope: "own", companyId: hub.company_id },
  ] };
  assert.equal(canManageHubStaff(access, hub), false);
  assert.equal(canManageHubStaff({ ...access, grants: [{ permission: "hubs.edit", scope: "company", companyId: hub.company_id }] }, hub), true);
  assert.equal(canManageHubStaff({ ...access, grants: [{ permission: "hubs.edit", scope: "company", companyId: "outside" }] }, hub), false);
  assert.equal(canManageHubStaff({ ...access, superAdmin: true }, hub), true);
  assert.ok(listSidebarMenu(["hubs"], { pages: ["hubs"], permissions: ["hubs.view"] }).some((item) => item.href === "/hubs"));
  assert.ok(!listSidebarMenu(["hubs"], { pages: ["hubs"], permissions: [] }).some((item) => item.href === "/hubs"));
});
