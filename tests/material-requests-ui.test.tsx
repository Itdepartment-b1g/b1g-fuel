import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { makeStore } from "@/lib/store/store";
import { actionMaterialRequest, getMaterialRequestCatalog, listMaterialRequest } from "@/lib/store/material-requests-slice";
import { RequestProductPicker } from "@/components/material-requests/request-product-picker";
import type { MaterialRequest } from "@/types/material-requests";

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
    return new Response(JSON.stringify({ error: "Set the company code." }), { status: 400 });
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
