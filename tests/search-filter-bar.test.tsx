import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SearchToolbar } from "@/components/common/filter/search-toolbar";
import { ViewToggle } from "@/components/common/filter/search-filter-bar";

test("mobile toolbar keeps search and filter labels for assistive text", () => {
  const html = renderToStaticMarkup(
    <SearchToolbar
      searchValue=""
      onSearchValueChange={() => {}}
      onSearch={() => {}}
      onQuickFilterClick={() => {}}
      trailingContent={<span>Date</span>}
    />,
  );
  assert.match(html, /flex-col gap-3 sm:flex-row/);
  assert.match(html, /sr-only sm:not-sr-only">Search</);
  assert.match(html, /sr-only sm:not-sr-only">Quick Filter</);
});

test("view toggle still exposes table and card choices", () => {
  const html = renderToStaticMarkup(
    <ViewToggle view="cards" onViewChange={() => {}} />,
  );
  assert.match(html, /aria-label="Card view"/);
  assert.match(html, /aria-pressed="true"/);
});
