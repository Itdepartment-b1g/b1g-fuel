import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { makeStore } from "@/lib/store/store";
import { actionMaterialRequest, createMaterialRequest, getMaterialRequestCatalog, getMaterialRequestFilterOption, listMaterialRequest } from "@/lib/store/material-requests-slice";
import { RequestProductPicker } from "@/components/material-requests/request-product-picker";
import type { MaterialRequest } from "@/types/material-requests";
import { allocate_request_number } from "@/server/repositories/material_requests_repository";
import type { DatabaseExecutor } from "@/server/lib/database";
import { MaterialRequestsTableView } from "@/components/material-requests/table-view/material-requests-table-view";
import type { TableAction } from "@/components/common/table/table-view";
import { materialRequestProgressEntries } from "@/components/material-requests/timeline-entries";
import { MaterialRequestItems } from "@/components/material-requests/table-view/material-request-items";
import { Timeline } from "@/components/common/timeline/timeline";
import { MaterialRequestsCards } from "@/components/material-requests/card-views/material-requests-cards";
import { MATERIAL_REQUEST_FILTER_DEFAULTS, MATERIAL_REQUEST_FILTER_OPTIONS } from "@/utils/material-request-filters";
import { createQuickFilterState } from "@/utils/quick-filter";
import { list_material_request as listMaterialRequestController } from "@/server/controllers/material_requests_controller";

test("material request row actions show review choices only with permission and pass the selected request", () => {
  const row = { id: "request", request_no: "MR-BFD-202610-0000001", status: "submitted", created_at: "2026-10-25T00:00:00Z", requesting_hub: { name: "Manila hub" }, requesting_company: { name: "B1G Fuel Distribution" }, supplying_company: { name: "Supplier" }, permissions: { edit: false, submit: false, cancel: false, review: true }, items: [{ requested_qty: "10", unit_label: "L" }, { requested_qty: "2.500", unit_label: "L" }] } as MaterialRequest;
  const selected: string[] = [];
  function view(record: MaterialRequest) { assert.equal(record, row); selected.push("view"); }
  function approve(record: MaterialRequest) { assert.equal(record, row); selected.push("approve"); }
  function reject(record: MaterialRequest) { assert.equal(record, row); selected.push("reject"); }
  function timeline(record: MaterialRequest) { assert.equal(record, row); selected.push("timeline"); }
  function receive(record: MaterialRequest) { assert.equal(record, row); selected.push("receive"); }
  function dispatchRequest(record: MaterialRequest) { assert.equal(record, row); selected.push("dispatch"); }
  const table = MaterialRequestsTableView({ rows: [row], loading: false, onView: view, onApprove: approve, onReject: reject, onDispatch: dispatchRequest, onReceive: receive, onTimeline: timeline });
  const html = renderToStaticMarkup(table);
  assert.match(html, /aria-label="Actions for MR-BFD-202610-0000001"/);
  assert.match(html, />Approve<\/button>/);
  assert.match(html, />Reject<\/button>/);
  assert.match(html, /text-emerald-600/);
  assert.match(html, /text-rose-600/);
  assert.doesNotMatch(html, />View<\/button>|>Timeline<\/button>/);
  for (const header of ["Request number", "Requesting hub", "Supplier", "Request Progress", "Total SKUs", "Total Qty", "Reviewed by", "Created at"]) assert.ok(html.includes(`aria-label="${header} column options"`));
  assert.match(html, /Pending/);
  assert.match(html, />2</);
  assert.match(html, /12\.5/);
  assert.doesNotMatch(html, /12\.5 L/);
  const cards = renderToStaticMarkup(<MaterialRequestsCards rows={[row]} onView={view} onApprove={approve} onReject={reject} onDispatch={dispatchRequest} onReceive={receive} onTimeline={timeline} />);
  assert.match(cards, /MR-BFD-202610-0000001/);
  assert.match(cards, /Awaiting review/);
  assert.match(cards, /Actions for MR-BFD-202610-0000001/);
  assert.match(cards, />Approve<\/button>/);
  assert.match(cards, />Reject<\/button>/);
  assert.match(cards, /Total SKUs/);
  assert.match(cards, /12\.5/);
  assert.doesNotMatch(cards, /12\.5 L/);
  const actions = table.props.actions(row) as TableAction<MaterialRequest>[];
  assert.deepEqual(actions.map((action) => action.id), ["approve", "reject", "view", "timeline"]);
  assert.ok(actions.find((action) => action.id === "view")?.icon);
  assert.ok(actions.find((action) => action.id === "timeline")?.icon);
  actions.forEach((action) => action.onSelect(row));
  assert.deepEqual(selected, ["approve", "reject", "view", "timeline"]);
  row.permissions!.review = false;
  const readOnly = table.props.actions(row) as TableAction<MaterialRequest>[];
  assert.deepEqual(readOnly.map((action) => action.id), ["view", "timeline"]);
  assert.doesNotMatch(renderToStaticMarkup(table), />Approve<\/button>|>Reject<\/button>|>Receive<\/button>/);
  row.status = "approved";
  row.events = [];
  row.permissions!.receive = true;
  row.permissions!.dispatch = true;
  const receivable = table.props.actions(row) as TableAction<MaterialRequest>[];
  assert.deepEqual(receivable.map((action) => action.id), ["dispatch", "receive", "view", "timeline"]);
  assert.match(renderToStaticMarkup(table), />Receive<\/button>/);
  assert.match(renderToStaticMarkup(table), /text-sky-600/);
  receivable[1].onSelect(row);
  assert.equal(selected.at(-1), "receive");
  receivable[0].onSelect(row);
  assert.equal(selected.at(-1), "dispatch");
  row.permissions!.receive = false;
  row.permissions!.dispatch = false;
  row.status = "draft";
  assert.equal((table.props.actions(row) as TableAction<MaterialRequest>[]).find((action) => action.id === "view")?.label, "View draft");
});

test("MR list serializes shared filters and sorting, and fetches authenticated filter choices", async () => {
  const original = globalThis.fetch;
  const store = makeStore();
  const filters = createQuickFilterState(MATERIAL_REQUEST_FILTER_DEFAULTS);
  filters.status = "submitted";
  const query = { page: 2, page_size: 20, search: "Manila", filters, sort_by: "request_no", sort_order: "asc" as const };
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(init?.credentials, "include");
      const parsed = new URL(String(url), "http://localhost");
      assert.equal(parsed.searchParams.get("sort_by"), "request_no");
      assert.equal(parsed.searchParams.get("sort_order"), "asc");
      assert.equal(parsed.searchParams.get("page"), "2");
      assert.deepEqual(JSON.parse(parsed.searchParams.get("filters")!), filters);
      return new Response(JSON.stringify({ requests: [], total: 0, page: 1, page_size: 20 }));
    };
    await store.dispatch(listMaterialRequest(query)).unwrap();
    assert.deepEqual(store.getState().materialRequests.list.query, query);
    globalThis.fetch = async (url, init) => {
      assert.equal(url, "/api/material-requests/filter-options");
      assert.equal(init?.credentials, "include");
      return new Response(JSON.stringify(MATERIAL_REQUEST_FILTER_OPTIONS));
    };
    await store.dispatch(getMaterialRequestFilterOption()).unwrap();
    assert.deepEqual(store.getState().materialRequests.filterOptions.data, MATERIAL_REQUEST_FILTER_OPTIONS);
  } finally { globalThis.fetch = original; }
});

test("MR list rejects unsupported sorting and invalid shared filters before querying the database", async () => {
  const filters = createQuickFilterState(MATERIAL_REQUEST_FILTER_DEFAULTS);
  const queries = [
    { sort_by: "reviewed_by", sort_order: "asc" },
    { sort_by: "created_at", sort_order: "sideways" },
    { filters: "not-json" },
    { filters: JSON.stringify({ ...filters, status: "unknown" }) },
    { filters: JSON.stringify({ ...filters, conditions: [{ id: "bad", field: "hub", value: "not-a-uuid" }] }) },
    { filters: JSON.stringify({ ...filters, date: { preset: "custom", from: "2020-10-99", to: "" } }) },
  ];
  for (const query of queries) {
    let code = 0;
    let body: { error?: string } = {};
    const response = { locals: { access: { userId: "actor", superAdmin: true, companyIds: [], grants: [], pages: [] } }, status(value: number) { code = value; return this; }, json(value: { error?: string }) { body = value; return this; } };
    await listMaterialRequestController({ query } as unknown as Parameters<typeof listMaterialRequestController>[0], response as unknown as Parameters<typeof listMaterialRequestController>[1]);
    assert.equal(code, 400);
    assert.ok(body.error);
  }
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
    return renderToStaticMarkup(<MaterialRequestsTableView rows={[row]} loading={false} onView={() => {}} onApprove={() => {}} onReject={() => {}} onDispatch={() => {}} onReceive={() => {}} onTimeline={() => {}} />);
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

test("material request previews show details and materials without the separate timeline", () => {
  const record = {
    id: "request", request_no: "MR-BFD-202610-0000001", status: "submitted",
    created_at: "2026-10-25T00:00:00Z", created_by_name: "Request creator", submitted_at: "2026-10-25T01:00:00Z", needed_at: "2026-10-26T00:00:00Z",
    requesting_company: { id: "company", name: "B1G Fuel Distribution" }, requesting_hub: { id: "hub", name: "Manila hub" },
    supplying_company: { id: "supplier", name: "Supplying company" }, supplying_warehouse: null, notes: "Deliver before noon",
    items: [{ id: "item", product_id: "product", unit_id: "unit", product_label: "Premium fuel", unit_label: "L", requested_qty: "12.5", approved_qty: null }],
    events: [{ id: "event", kind: "submitted", from_status: "draft", to_status: "submitted", note: "Urgent delivery", created_by: "actor", created_by_name: "Reviewer", created_at: "2026-10-25T01:00:00Z" }],
  } as MaterialRequest;
  const table = MaterialRequestsTableView({ rows: [record], loading: false, onView: () => {}, onApprove: () => {}, onReject: () => {}, onDispatch: () => {}, onReceive: () => {}, onTimeline: () => {} });
  const collapsed = renderToStaticMarkup(table);
  assert.match(collapsed, /aria-label="Expand row request" aria-expanded="false"/);
  assert.doesNotMatch(collapsed, /Premium fuel|Deliver before noon|Urgent delivery/);
  const details = renderToStaticMarkup(table.props.expandedRow(record));
  for (const text of ["Manila hub", "Supplying company", "Awaiting assignment", "Request creator", "Deliver before noon", "Requested materials", "Premium fuel", "12.5"]) {
    assert.ok(details.includes(text), `Missing request detail: ${text}`);
  }
  assert.doesNotMatch(details, /Timeline|Reviewer|Urgent delivery/);
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
  store.dispatch(getMaterialRequestCatalog.fulfilled({ products: [{ id: "fuel", label: "Brand / Premium / Fuel", brand_name: "Brand", variant_name: "Premium", product_type_name: "Fuel", unit_id: "litre", unit_label: "L" }], total: 20, page: 1, page_size: 10 }, "catalog", query));
  function render(supplierId = "supplier") {
    return renderToStaticMarkup(<Provider store={store}><RequestProductPicker hubId="hub" supplierId={supplierId} disabled={false} onChange={() => {}} items={[{ product_id: "other-page", label: "Other selected material", brand_name: "Other brand", variant_name: "Other selected material", product_type_name: "Fuel", unit_label: "L", requested_qty: "10" }]} /></Provider>);
  }
  const html = render();
  assert.match(html, /Brand \/ Premium \/ Fuel/);
  assert.match(html, /Other selected material \(Fuel\)/);
  for (const header of ["Brand", "Variant", "Unit of Measure", "Qty"]) assert.ok(html.includes(`>${header}<`));
  assert.match(html, /Other brand/);
  assert.match(html, /value="10"/);
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
  const items = Array.from({ length: 11 }, (_, index) => ({ id: String(index), product_id: "product", unit_id: "unit", product_label: `Material ${index + 1} end`, brand_name: "Brand", variant_name: "Variant", product_type_name: "Fuel", unit_label: "L", requested_qty: "10", approved_qty: null, dispatched_qty: "0", received_qty: "0" }));
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
