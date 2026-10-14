import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { makeStore } from "@/lib/store/store";
import { createMeasurement, deleteMeasurement, editMeasurement, getMeasurementOption, listMeasurement, updateMeasurement } from "@/lib/store/measurements-slice";
import { moveMeasurementEntry, prepareMeasurementEntries } from "@/utils/measurement-form";
import { ToastProvider } from "@/components/providers/toast-provider";
import { MeasurementForm } from "@/components/measurements/dialog/measurement-form";
import { MeasurementsTableView } from "@/components/measurements/table-view/measurements-table-view";
import { listSidebarMenu } from "@/app/layout/sideBarMenuItems";
import type { MeasurementSummary } from "@/types/measurements";

const measurement: MeasurementSummary = {
  id: "30000000-0000-4000-8000-000000000001", company_id: "30000000-0000-4000-8000-000000000002",
  company: { id: "30000000-0000-4000-8000-000000000002", name: "B1G Fuel" },
  created_by: "creator", created_by_name: "Ada", name: "Dimensions",
  created_at: "2026-10-14T00:00:00Z", updated_at: "2026-10-14T00:00:00Z",
  units: [{ id: "unit-cm", key: "cm", name: "Centimeter", symbol: "cm" }],
};
const page = { measurements: [measurement], total: 1, page: 1, page_size: 10 };

test("Redux ignores stale list and detail responses", () => {
  const store = makeStore();
  store.dispatch(listMeasurement.pending("old", { search: "old" }));
  store.dispatch(listMeasurement.pending("current", { search: "new" }));
  store.dispatch(listMeasurement.fulfilled(page, "old", { search: "old" }));
  assert.equal(store.getState().measurements.measurements.length, 0);
  store.dispatch(listMeasurement.fulfilled(page, "current", { search: "new" }));
  assert.equal(store.getState().measurements.total, 1);
  store.dispatch(editMeasurement.pending("old-detail", "old-id"));
  store.dispatch(editMeasurement.pending("new-detail", measurement.id));
  store.dispatch(editMeasurement.fulfilled({ measurement }, "old-detail", "old-id"));
  assert.equal(store.getState().measurements.selectedMeasurement, null);
});
test("successful mutations invalidate pending reads, while failed saves remain retryable", () => {
  const store = makeStore();
  store.dispatch(listMeasurement.pending("read", {}));
  const input = { id: measurement.id, name: "Package dimensions" };
  store.dispatch(updateMeasurement.pending("save", input));
  store.dispatch(updateMeasurement.fulfilled({ measurement: { ...measurement, name: input.name } }, "save", input));
  store.dispatch(listMeasurement.fulfilled(page, "read", {}));
  assert.equal(store.getState().measurements.selectedMeasurement?.name, input.name);
  assert.equal(store.getState().measurements.listStatus, "idle");
  store.dispatch(updateMeasurement.pending("retry", input));
  store.dispatch(updateMeasurement.rejected(null, "retry", input, { status: 409, message: "Duplicate name" }));
  assert.equal(store.getState().measurements.mutationStatus, "failed");
  assert.equal(store.getState().measurements.mutationError?.status, 409);
  assert.equal(store.getState().measurements.selectedMeasurement?.name, input.name);
});
test("thunks use the API with cookies and serialize nested definitions", async () => {
  const original = globalThis.fetch;
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    const body = init?.method === "DELETE" ? { id: measurement.id, message: "Measurement deleted." } : init?.method === "POST" ? { measurement } : page;
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const store = makeStore();
    await store.dispatch(listMeasurement({ search: "Weight & Volume", page: 2 })).unwrap();
    const listed = new URL(calls[0].url, "http://test");
    assert.equal(listed.searchParams.get("search"), "Weight & Volume");
    assert.equal(listed.searchParams.get("page"), "2");
    assert.equal(listed.searchParams.get("is_active"), null);
    assert.equal(calls[0].init?.credentials, "include");
    assert.ok(calls[0].init?.signal);
    const input = { company_id: measurement.company_id, name: measurement.name, units: measurement.units };
    await store.dispatch(createMeasurement(input)).unwrap();
    assert.equal(calls[1].init?.method, "POST");
    assert.deepEqual(JSON.parse(String(calls[1].init?.body)), input);
    await store.dispatch(deleteMeasurement(measurement.id)).unwrap();
    assert.equal(calls[2].init?.method, "DELETE");
    assert.equal(store.getState().measurements.selectedMeasurement, null);
  } finally { globalThis.fetch = original; }
});
test("API errors retain their status and message, and simultaneous mutations are blocked", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ error: "Permission denied" }), { status: 403 }); };
  try {
    const store = makeStore();
    const input = { id: measurement.id, name: "Mass" };
    await assert.rejects(store.dispatch(updateMeasurement(input)).unwrap(), (error: unknown) => Boolean(error && typeof error === "object" && "status" in error && error.status === 403));
    assert.equal(store.getState().measurements.mutationError?.message, "Permission denied");
    store.dispatch(updateMeasurement.pending("in-flight", input));
    const action = await store.dispatch(deleteMeasurement(measurement.id));
    assert.ok(deleteMeasurement.rejected.match(action) && action.meta.condition);
    assert.equal(calls, 1);
    assert.equal(store.getState().measurements.mutationStatus, "loading");
  } finally { globalThis.fetch = original; }
});
test("generated keys remain unique and saved keys survive renaming and reordering", () => {
  const entries = [
    { key: "length", name: "Renamed length", symbol: "rl" },
    { key: "", name: "Length", symbol: "l" },
    { key: "", name: "Length", symbol: "l2" },
  ];
  const result = prepareMeasurementEntries(moveMeasurementEntry(entries, 0, 1));
  assert.deepEqual(result.map((entry) => entry.key), ["length_2", "length", "length_3"]);
});
test("measurement forms collect a name and units, and ask for a company only when several are available", () => {
  const store = makeStore();
  store.dispatch(getMeasurementOption.pending("options", undefined));
  store.dispatch(getMeasurementOption.fulfilled({ companies: [measurement.company] }, "options", undefined));
  const render = (existing?: MeasurementSummary) => renderToStaticMarkup(<Provider store={store}><ToastProvider><MeasurementForm measurement={existing} onSaved={() => {}} onCancel={() => {}} /></ToastProvider></Provider>);
  const create = render();
  assert.match(create, /Measurement name/);
  assert.match(create, /Add unit/);
  assert.doesNotMatch(create, /Select a company/);
  assert.doesNotMatch(create, /Add field/);
  assert.doesNotMatch(create, /Required/);
  const several = makeStore();
  several.dispatch(getMeasurementOption.pending("options", undefined));
  several.dispatch(getMeasurementOption.fulfilled({ companies: [measurement.company, { id: "30000000-0000-4000-8000-000000000003", name: "Other Fuel" }] }, "options", undefined));
  const choice = renderToStaticMarkup(<Provider store={several}><ToastProvider><MeasurementForm onSaved={() => {}} onCancel={() => {}} /></ToastProvider></Provider>);
  assert.match(choice, /Select a company/);
  assert.match(choice, /B1G Fuel/);
  const edit = render(measurement);
  assert.match(edit, /value="Centimeter"/);
  assert.match(edit, /value="cm"/);
  assert.doesNotMatch(edit, /Remove unit/);
  assert.doesNotMatch(edit, /Measurement active/);
  const table = renderToStaticMarkup(<MeasurementsTableView measurements={[measurement]} loading={false} sorting={null} onSortingChange={() => {}} onEdit={() => {}} onDelete={() => {}} disabled={false} />);
  assert.match(table, />cm</);
  assert.match(table, /Created by/);
  assert.match(table, /Ada/);
  assert.match(table, /Delete/);
  assert.match(table, /Expand row/);
  assert.doesNotMatch(table, /Archive/);
});
test("measurement navigation points to the implemented route and respects view permissions", () => {
  assert.ok(listSidebarMenu([], { role: "super_admin" }).some((item) => item.href === "/measurements"));
  assert.equal(listSidebarMenu(["measurements"], { pages: ["measurements"], permissions: [] }).length, 0);
  assert.equal(listSidebarMenu(["measurements"], { pages: ["measurements"], permissions: ["measurements.view"] })[0].href, "/measurements");
});
