import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { makeStore } from "@/lib/store/store";
import { actionMaterialRequest, createMaterialRequest, getMaterialRequestCatalog, listMaterialRequest } from "@/lib/store/material-requests-slice";
import { RequestProductPicker } from "@/components/material-requests/request-product-picker";
import type { MaterialRequest } from "@/types/material-requests";
import { allocate_request_number } from "@/server/repositories/material_requests_repository";
import type { DatabaseExecutor } from "@/server/lib/database";
import { MaterialRequestsTableView } from "@/components/material-requests/table-view/material-requests-table-view";
import type { TableAction } from "@/components/common/table/table-view";
import { materialRequestProgressEntries } from "@/components/material-requests/timeline-entries";
import { MaterialRequestItems } from "@/components/material-requests/table-view/material-request-items";
import { Timeline } from "@/components/common/timeline/timeline";

test("material request row actions show review choices only with permission and pass the selected request", () => {
  const row = { id: "request", request_no: "MR-BFD-202610-0000001", status: "submitted", created_at: "2026-10-25T00:00:00Z", requesting_hub: { name: "Manila hub" }, requesting_company: { name: "B1G Fuel Distribution" }, supplying_company: { name: "Supplier" }, permissions: { edit: false, submit: false, cancel: false, review: true } } as MaterialRequest;
  const selected: string[] = [];
  function view(record: MaterialRequest) { assert.equal(record, row); selected.push("view"); }
  function approve(record: MaterialRequest) { assert.equal(record, row); selected.push("approve"); }
  function reject(record: MaterialRequest) { assert.equal(record, row); selected.push("reject"); }
  function timeline(record: MaterialRequest) { assert.equal(record, row); selected.push("timeline"); }
  const table = MaterialRequestsTableView({ rows: [row], loading: false, onView: view, onApprove: approve, onReject: reject, onTimeline: timeline });
  const html = renderToStaticMarkup(table);
  assert.match(html, />Approve<\/button>/);
  assert.match(html, />Reject<\/button>/);
  assert.match(html, />View<\/button>/);
  assert.match(html, />Timeline<\/button>/);
  const actions = table.props.actions(row) as TableAction<MaterialRequest>[];
  actions.forEach((action) => action.onSelect(row));
  assert.deepEqual(selected, ["approve", "reject", "view", "timeline"]);
  row.permissions!.review = false;
  const readOnly = renderToStaticMarkup(table);
  assert.doesNotMatch(readOnly, />Approve<\/button>|>Reject<\/button>/);
  assert.match(readOnly, />View<\/button>/);
  assert.match(readOnly, />Timeline<\/button>/);
  row.status = "draft";
  assert.match(renderToStaticMarkup(table), />View draft<\/button>/);
});

test("request numbers use company initials and count per company and Manila month", async () => {
  const counters = new Map<string, number>();
  const tx = { material_request_counter: { upsert: async ({ where }: { where: { company_id_period: { company_id: string; period: string } } }) => {
    const { company_id, period } = where.company_id_period;
    const key = `${company_id}:${period}`;
    const last_value = (counters.get(key) ?? 0) + 1;
    counters.set(key, last_value);
    return { last_value };
  } } } as unknown as DatabaseExecutor;
  const october = new Date("2026-10-31T15:59:59Z");
  assert.equal(await allocate_request_number("requester", "B1G Fuel Distribution", october, tx), "MR-BFD-202610-0000001");
  assert.equal(await allocate_request_number("requester", "B1G Fuel Distribution", october, tx), "MR-BFD-202610-0000002");
  assert.equal(await allocate_request_number("other", "B1G Fuel Distribution", october, tx), "MR-BFD-202610-0000001");
  assert.equal(await allocate_request_number("requester", "B1G Fuel Distribution", new Date("2026-10-31T16:00:00Z"), tx), "MR-BFD-202611-0000001");
  assert.equal(await allocate_request_number("single", "  Fuel  ", october, tx), "MR-F-202610-0000001");
  assert.equal(await allocate_request_number("punctuation", "B1G-Fuel & Distribution", october, tx), "MR-BFD-202610-0000001");
});

test("Reviewed by shows the approval or rejection actor and stays empty before review", () => {
  const row = {
    id: "request", request_no: "MR-BFD-202610-0000001", status: "approved", created_at: "2026-10-25T00:00:00Z",
    requesting_hub: { name: "Manila hub" }, requesting_company: { name: "B1G Fuel Distribution" }, supplying_company: { name: "Supplier" },
    events: [
      { id: "created", kind: "created", to_status: "draft", created_by_name: "Request creator" },
      { id: "reviewed", kind: "approved", to_status: "approved", created_by_name: "Approval reviewer" },
    ],
  } as MaterialRequest;
  function render() {
    return renderToStaticMarkup(<MaterialRequestsTableView rows={[row]} loading={false} onView={() => {}} onApprove={() => {}} onReject={() => {}} onTimeline={() => {}} />);
  }
  assert.match(render(), /Reviewed by/);
  assert.match(render(), /Approval reviewer/);
  assert.doesNotMatch(render(), /Request creator/);
  row.status = "rejected";
  row.events[1] = { ...row.events[1], kind: "rejected", to_status: "rejected", created_by_name: "Rejection reviewer" };
  assert.match(render(), /Rejection reviewer/);
  assert.doesNotMatch(render(), /Approval reviewer/);
  row.events[1].created_by_name = null;
  assert.match(render(), /Unavailable user/);
  for (const status of ["draft", "submitted", "cancelled"] as const) {
    row.status = status;
    assert.doesNotMatch(render(), /Unavailable user|Rejection reviewer|Approval reviewer|Request creator/);
    if (status === "submitted") assert.match(render(), /Awaiting review/);
    else assert.doesNotMatch(render(), /Awaiting review/);
  }
});

test("create sends draft or submit intent in one authenticated request", async () => {
  const original = globalThis.fetch;
  const store = makeStore();
  let calls = 0;
  try {
    for (const submit of [false, true]) {
      const input = { requesting_hub_id: "hub", supplying_company_id: "supplier", items: [{ product_id: "product", requested_qty: "10" }], submit };
      globalThis.fetch = async (url, init) => {
        calls++;
        assert.equal(url, "/api/material-requests");
        assert.equal(init?.method, "POST");
        assert.equal(init?.credentials, "include");
        assert.deepEqual(JSON.parse(String(init?.body)), input);
        return new Response(JSON.stringify({ request: { id: "request", status: submit ? "submitted" : "draft" } }), { status: 201 });
      };
      const result = await store.dispatch(createMaterialRequest(input)).unwrap();
      assert.equal(result.status, submit ? "submitted" : "draft");
    }
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});

test("material requests reuse TableView expansion for materials, notes and timeline", () => {
  const record = {
    id: "request", request_no: "MR-BFD-202610-0000001", status: "submitted",
    created_at: "2026-10-25T00:00:00Z", created_by_name: "Request creator", submitted_at: "2026-10-25T01:00:00Z", needed_at: "2026-10-26T00:00:00Z",
    requesting_company: { id: "company", name: "B1G Fuel Distribution" }, requesting_hub: { id: "hub", name: "Manila hub" },
    supplying_company: { id: "supplier", name: "Supplying company" }, supplying_warehouse: null, notes: "Deliver before noon",
    items: [{ id: "item", product_id: "product", unit_id: "unit", product_label: "Premium fuel", unit_label: "L", requested_qty: "12.5", approved_qty: null }],
    events: [{ id: "event", kind: "submitted", from_status: "draft", to_status: "submitted", note: "Urgent delivery", created_by: "actor", created_by_name: "Reviewer", created_at: "2026-10-25T01:00:00Z" }],
  } as MaterialRequest;
  const table = MaterialRequestsTableView({ rows: [record], loading: false, onView: () => {}, onApprove: () => {}, onReject: () => {}, onTimeline: () => {} });
  const collapsed = renderToStaticMarkup(table);
  assert.match(collapsed, /aria-label="Expand row request" aria-expanded="false"/);
  assert.doesNotMatch(collapsed, /Premium fuel|Deliver before noon|Urgent delivery/);
  const details = renderToStaticMarkup(table.props.expandedRow(record));
  for (const text of ["Manila hub", "Supplying company", "Awaiting assignment", "Request creator", "Deliver before noon", "Requested materials", "Premium fuel", "12.5", "Timeline", "Reviewer", "Urgent delivery"]) {
    assert.ok(details.includes(text), `Missing request detail: ${text}`);
  }
  record.needed_at = null;
  record.submitted_at = null;
  record.notes = "";
  record.events = [];
  const draftDetails = renderToStaticMarkup(table.props.expandedRow(record));
  assert.match(draftDetails, /Not specified/);
  assert.match(draftDetails, /Not submitted/);
});

test("material picker renders paginated supplier choices and keeps selected items from other pages", () => {
  const store = makeStore();
  const query = { hub_id: "hub", supplier_id: "supplier", search: "", page: 1, page_size: 10 };
  store.dispatch(getMaterialRequestCatalog.pending("catalog", query));
  store.dispatch(getMaterialRequestCatalog.fulfilled({ products: [{ id: "fuel", label: "Brand / Premium / Fuel", unit_id: "litre", unit_label: "L" }], total: 20, page: 1, page_size: 10 }, "catalog", query));
  function render(supplierId = "supplier") {
    return renderToStaticMarkup(<Provider store={store}><RequestProductPicker hubId="hub" supplierId={supplierId} disabled={false} onChange={() => {}} items={[{ product_id: "other-page", label: "Other selected material", unit_label: "L", requested_qty: "10" }]} /></Provider>);
  }
  const html = render();
  assert.match(html, /Brand \/ Premium \/ Fuel/);
  assert.match(html, /Other selected material/);
  assert.match(html, /Next/);
  assert.equal((html.match(/>Add</g) ?? []).length, 1);
  assert.doesNotMatch(render("another-supplier"), /Brand \/ Premium \/ Fuel/);
});

test("MR progress includes a materials table at each step and approved quantities only after approval", () => {
  const record = {
    id: "request", status: "approved", requesting_company: { name: "Requesting company" }, requesting_hub: { name: "Manila hub" }, supplying_company: { name: "Supplier" },
    supplying_warehouse: { name: "Approved warehouse" }, needed_at: null, submitted_at: "2026-10-25T01:00:00Z", created_by_name: "Creator", notes: "Deliver tomorrow",
    items: [{ id: "item", product_label: "Premium fuel", unit_label: "L", requested_qty: "12.5", approved_qty: "12.5" }],
    events: [
      { id: "created", kind: "created", to_status: "draft", created_at: "2026-10-25T00:00:00Z", created_by_name: "Creator", note: "" },
      { id: "submitted", kind: "submitted", to_status: "submitted", created_at: "2026-10-25T01:00:00Z", created_by_name: "Creator", note: "" },
      { id: "approved", kind: "approved", to_status: "approved", created_at: "2026-10-25T02:00:00Z", created_by_name: "Reviewer", note: "Ready for dispatch" },
    ],
  } as MaterialRequest;
  const entries = materialRequestProgressEntries(record, "table");
  const html = renderToStaticMarkup(<Timeline entries={entries} />);
  assert.equal((html.match(/<caption/g) ?? []).length, 3);
  assert.equal((html.match(/Premium fuel/g) ?? []).length, 3);
  assert.match(html, /Request created/);
  assert.match(html, /Submitted for review/);
  assert.match(html, /Request approved/);
  assert.match(html, /Deliver tomorrow/);
  assert.match(html, /Ready for dispatch/);
  const created = renderToStaticMarkup(<>{entries[0].content}</>);
  const approved = renderToStaticMarkup(<>{entries[2].content}</>);
  assert.doesNotMatch(created, /Approved warehouse/);
  assert.match(created, /Awaiting assignment/);
  assert.equal((created.match(/>12\.5<\/td>/g) ?? []).length, 1);
  assert.equal((approved.match(/>12\.5<\/td>/g) ?? []).length, 2);
  assert.match(approved, /Approved warehouse/);
  const cards = renderToStaticMarkup(<Timeline entries={materialRequestProgressEntries(record, "cards")} />);
  assert.equal((cards.match(/<article/g) ?? []).length, 3);
  assert.doesNotMatch(cards, /<table/);
});

test("MR material tables and cards paginate and handle empty materials", () => {
  const items = Array.from({ length: 11 }, (_, index) => ({ id: String(index), product_id: "product", unit_id: "unit", product_label: `Material ${index + 1} end`, unit_label: "L", requested_qty: "10", approved_qty: null }));
  for (const view of ["table", "cards"] as const) {
    const html = renderToStaticMarkup(<MaterialRequestItems items={items} view={view} />);
    assert.match(html, /Material 10 end/);
    assert.doesNotMatch(html, /Material 11 end/);
    assert.match(html, /Next/);
    assert.match(renderToStaticMarkup(<MaterialRequestItems items={[]} view={view} />), /No materials yet/);
  }
});

test("Redux sends authenticated action requests, rejects duplicate writes, preserves errors for retry and ignores stale reads", async () => {
  const original = globalThis.fetch;
  const store = makeStore();
  const input = { id: "request", action: "submit" as const };
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(url, "/api/material-requests/action");
    assert.equal(init?.credentials, "include");
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(String(init?.body)), input);
    await gate;
    return new Response(JSON.stringify({ error: "An active company supply link is required." }), { status: 400 });
  };
  try {
    const first = store.dispatch(actionMaterialRequest(input));
    const duplicate = await store.dispatch(actionMaterialRequest(input));
    assert.ok(actionMaterialRequest.rejected.match(duplicate) && duplicate.meta.condition);
    release();
    await first;
    assert.equal(calls, 1);
    assert.equal(store.getState().materialRequests.mutation.error?.status, 400);
    const query = { page: 1 };
    store.dispatch(listMaterialRequest.pending("before-write", query));
    globalThis.fetch = async () => new Response(JSON.stringify({ request: { id: "request", request_no: "MR-BFW-202610-0000001" } }));
    await store.dispatch(actionMaterialRequest(input)).unwrap();
    store.dispatch(listMaterialRequest.fulfilled({ requests: [{} as MaterialRequest], total: 1, page: 1, page_size: 10 }, "before-write", query));
    assert.equal(store.getState().materialRequests.list.data, null);
    assert.equal(store.getState().materialRequests.mutation.error, null);
  } finally { release(); globalThis.fetch = original; }
});
