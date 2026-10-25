import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { InventoryTableView, InventoryVariantsTable } from "@/components/inventory/table-view/inventory-table-view";
import { HistoryTableView } from "@/components/inventory/table-view/history-table-view";
import { MovementQuantity, formatQuantity } from "@/components/inventory/quantity";
import { makeStore } from "@/lib/store/store";
import { listInventoryBrands, getInventoryHistory, inventoryQueryString } from "@/lib/store/inventory-slice";
import { inventory_spreadsheet } from "@/server/utils/inventory-export";
import { InventoryMobile } from "@/components/inventory/table-view/inventory-mobile";
import type { InventoryBrand, InventoryMovement } from "@/types/inventory";
import { createQuickFilterState } from "@/utils/quick-filter";

const brand: InventoryBrand = { id: "brand", name: "Example brand", sku_count: 1, totals: [{ unit: "Litre (L)", qty: "100.125", net_movement: "-10" }, { unit: "Piece (pcs)", qty: "20", net_movement: "2" }], variants: [{
  id: "balance", company: { id: "company", name: "Company" }, facility: { id: "facility", name: "Central warehouse", type: "warehouse", is_active: true },
  product: { id: "sku", brand: { id: "brand", name: "Example brand" }, variant: { id: "variant", name: "Premium" }, product_type: { id: "type", name: "Refill" }, base_unit: { id: "unit", name: "Litre", symbol: "L" } }, qty: "100.125", net_movement: "-10", updated_at: "2026-10-26T00:00:00.000Z",
}] };
const movement: InventoryMovement = { id: "movement", qty: "10", direction: "out", type: "dispatch_out", source_line_id: "line", balance_before: "110.125", balance_after: "100.125", reference_no: "MRD-001", remarks: "Requested materials", source_href: null, created_by: "actor", created_by_name: "Warehouse staff", created_at: "2026-10-26T00:00:00.000Z" };

test("brand table exposes accessible accordion controls and preserves separate unit totals", () => {
  const html = renderToStaticMarkup(<InventoryTableView brands={[brand, { ...brand, id: "second", name: "Second brand" }]} loading={false} />);
  assert.equal((html.match(/aria-label="Expand row /g) ?? []).length, 2);
  for (const label of ["Brand", "SKUs", "Total Stock", "Stock Movement"]) assert.ok(html.includes(`${label} column options`));
  const overviewHeader = html.match(/<caption[^>]*>Inventory by brand<\/caption>[\s\S]*?<\/thead>/)?.[0];
  assert.ok(overviewHeader);
  assert.doesNotMatch(overviewHeader, /Unit of Measure column options/);
  assert.match(html, /aria-controls=/);
  assert.match(html, /Example brand/);
  assert.match(html, /100\.125 Litre \(L\)/);
  assert.match(html, /20 Piece \(pcs\)/);
  assert.match(html, /text-red-600/);
  assert.match(html, /text-emerald-700/);
  assert.match(html, /text-right/);
});

test("expanded variants identify their facility and link to the correct history", () => {
  const html = renderToStaticMarkup(<InventoryVariantsTable brand={brand} />);
  assert.match(html, /Premium/);
  assert.match(html, /Refill/);
  assert.match(html, /Unit of Measure/);
  assert.match(html, /Litre \(L\)/);
  assert.match(html, /Central warehouse/);
  assert.doesNotMatch(html, /SKU sku|title="sku"/);
  assert.match(html, /href="\/inventory\/balance\/history"/);
  for (const label of ["Variant", "Product Type", "Unit of Measure", "Available Stock", "Stock Movement"]) assert.ok(html.includes(`${label} column options`));
});

test("accordion variants sort before pagination and expose independent shared page controls", () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({
    ...brand.variants[0], id: `balance-${index + 1}`,
    product: { ...brand.variants[0].product, variant: { id: `variant-${index + 1}`, name: `Variant ${String(index + 1).padStart(2, "0")}` } },
  })).reverse();
  const html = renderToStaticMarkup(<InventoryVariantsTable brand={{ ...brand, variants: rows }} />);
  assert.match(html, /Variant 01/);
  assert.match(html, /Variant 10/);
  assert.doesNotMatch(html, /Variant 11|Variant 12/);
  assert.equal((html.match(/href="\/inventory\/balance-/g) ?? []).length, 10);
  assert.match(html, /Rows per page/);
  assert.match(html, /Next page/);
  assert.match(html, /Page 1 of 2/);
});

test("mobile inventory uses independent native accordions with stock visible in each summary", () => {
  const html = renderToStaticMarkup(<InventoryMobile brands={[brand, { ...brand, id: "second" }]} loading={false} />);
  assert.equal((html.match(/<details/g) ?? []).length, 2);
  assert.match(html, /Total Stock/);
  assert.match(html, /Stock Movement/);
  assert.match(html, /100\.125 Litre \(L\)/);
  assert.equal((html.match(/<table/g) ?? []).length, 2);
  assert.match(html, /Available Stock column options/);
  assert.match(html, /Unit of Measure column options/);
  assert.match(html, /href="\/inventory\/balance\/history"/);
  assert.match(html, /Central warehouse/);
});

test("movement history shows signed quantities, saved balances and explicit unavailable history", () => {
  const html = renderToStaticMarkup(<HistoryTableView movements={[movement, { ...movement, id: "legacy", balance_after: null }]} loading={false} unit="Litre (L)" onView={() => {}} />);
  for (const label of ["Date &amp; Time", "Reference No.", "Movement Type", "Transaction Type", "Movement Qty", "Balance After", "Processed By", "MRD-001", "Material dispatch", "Warehouse staff", "Unavailable"]) assert.ok(html.includes(label), label);
  assert.match(html, /100\.125 Litre \(L\)/);
  assert.match(html, /-10/);
  for (const label of ["Date &amp; Time", "Reference No.", "Unit of Measure", "Movement Qty", "Balance After"]) assert.ok(html.includes(`${label} column options`));
  assert.equal((html.match(/View movement MRD-001/g) ?? []).length, 2);
  assert.match(renderToStaticMarkup(<HistoryTableView movements={[]} loading={false} unit="Litre (L)" onView={() => {}} />), /No stock movements match/);
  assert.match(renderToStaticMarkup(<InventoryTableView brands={[]} loading />), /Loading records/);
});

test("quantity display preserves decimal precision and distinguishes zero from positive movement", () => {
  assert.equal(formatQuantity("99999999999.999"), "99,999,999,999.999");
  assert.equal(formatQuantity("1000.100"), "1,000.1");
  assert.match(renderToStaticMarkup(<MovementQuantity value="0" />), /text-muted-foreground/);
  assert.doesNotMatch(renderToStaticMarkup(<MovementQuantity value="0" />), /\+0/);
  assert.match(renderToStaticMarkup(<MovementQuantity value="5" />), /\+5/);
});

test("Excel export escapes user content and emits text cells rather than formulas", () => {
  const xml = inventory_spreadsheet(["Reference", "Remarks"], [["=HYPERLINK(\"https://example.test\")", "A&B <delivery>"], [null, "\u0000safe"]]);
  assert.match(xml, /urn:schemas-microsoft-com:office:spreadsheet/);
  assert.match(xml, /ss:Type="String"/);
  assert.match(xml, /A&amp;B &lt;delivery&gt;/);
  assert.match(xml, /Unavailable/);
  assert.doesNotMatch(xml, /ss:Formula|\u0000/);
});

test("inventory Redux ignores stale results and serializes filters for authenticated requests", async () => {
  const store = makeStore();
  const filters = createQuickFilterState({ status: "all", additional: { facility_type: "all" } });
  const query = { search: "Premium", filters, page: 2, page_size: 10, sort_by: "skus", sort_order: "desc" as const };
  const params = new URLSearchParams(inventoryQueryString(query));
  assert.equal(params.get("page"), "2");
  assert.equal(params.get("sort_by"), "skus");
  assert.equal(params.get("sort_order"), "desc");
  assert.deepEqual(JSON.parse(params.get("filters")!), filters);
  store.dispatch(listInventoryBrands.pending("old", query));
  store.dispatch(listInventoryBrands.pending("new", query));
  store.dispatch(listInventoryBrands.fulfilled({ brands: [brand], total: 1, page: 1, page_size: 10 }, "old", query));
  assert.equal(store.getState().inventory.brands.data, null);
  store.dispatch(getInventoryHistory.pending("old-history", { inventory_id: "old" }));
  store.dispatch(getInventoryHistory.pending("new-history", { inventory_id: "new" }));
  store.dispatch(getInventoryHistory.rejected(new Error("Old failure"), "old-history", { inventory_id: "old" }, { status: 403, message: "Old failure" }));
  assert.equal(store.getState().inventory.history.error, null);
  const original = globalThis.fetch;
  let requested = "";
  try {
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      requested = String(url);
      assert.equal(init?.credentials, "include");
      return new Response(JSON.stringify({ brands: [brand], total: 1, page: 1, page_size: 10 }));
    }) as typeof fetch;
    await store.dispatch(listInventoryBrands(query)).unwrap();
    assert.match(requested, /^\/api\/inventory\/brands\?/);
    assert.equal(store.getState().inventory.brands.data?.brands[0].name, "Example brand");
  } finally { globalThis.fetch = original; }
});
