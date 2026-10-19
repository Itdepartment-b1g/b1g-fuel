import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { makeStore } from "@/lib/store/store";
import { getCompanySupplyOption } from "@/lib/store/company-supply-slice";
import { ToastProvider } from "@/components/providers/toast-provider";
import { CreateCompanySupplyFields } from "@/components/companies/dialog/company-supply-links-dialog";

test("supply picker renders the loaded page and hides results belonging to another company or direction", () => {
  const store = makeStore();
  const company = { id: "company-a", name: "Company A" };
  const query = { company_id: company.id, direction: "requesting" as const, search: "", page: 1, page_size: 10 };
  store.dispatch(getCompanySupplyOption.pending("options", query));
  store.dispatch(getCompanySupplyOption.fulfilled({ companies: [{ id: "company-b", name: "Central warehouse" }], total: 25, page: 1, page_size: 10 }, "options", query));
  function render(direction: "requesting" | "supplying", id = company.id) {
    return renderToStaticMarkup(<Provider store={store}><ToastProvider>
      <CreateCompanySupplyFields company={{ ...company, id }} direction={direction} revision={0} onSaved={() => {}} />
    </ToastProvider></Provider>);
  }
  const html = render("requesting");
  assert.match(html, /Search companies to link/);
  assert.match(html, /Supplying company/);
  assert.match(html, /Central warehouse/);
  assert.match(html, /Next/);
  assert.equal((html.match(/<option /g) ?? []).length, 2);
  assert.doesNotMatch(render("supplying"), /Central warehouse/);
  assert.doesNotMatch(render("requesting", "company-c"), /Central warehouse/);
});
