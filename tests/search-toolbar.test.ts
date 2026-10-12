import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SearchToolbar } from "../src/components/common/search-toolbar";

const props = { searchValue: "", onSearchValueChange() {}, onSearch() {} };

test("toolbar renders configurable search and a callback-only filter button", () => {
  const html = renderToStaticMarkup(createElement(SearchToolbar, {
    ...props, searchValue: "Juan", placeholder: "Find accounts", searchLabel: "Account search",
    searchButtonLabel: "Find", onQuickFilterClick() {}, quickFilterLabel: "Filter accounts",
  }));
  assert.match(html, /role="search"/);
  assert.match(html, /placeholder="Find accounts"/);
  assert.match(html, /value="Juan"/);
  assert.match(html, /Filter accounts/);
  assert.match(html, /Clear search/);
  assert.doesNotMatch(html, /role="dialog"|role="menu"|<select/);
});

test("toolbar supports loading, disabled and search-only configurations", () => {
  const searchOnly = renderToStaticMarkup(createElement(SearchToolbar, props));
  assert.doesNotMatch(searchOnly, /Quick Filter|Clear search/);
  const loading = renderToStaticMarkup(createElement(SearchToolbar, { ...props, loading: true }));
  assert.match(loading, /Searching/);
  assert.match(loading, /type="submit" disabled/);
  const disabled = renderToStaticMarkup(createElement(SearchToolbar, { ...props, disabled: true, onQuickFilterClick() {} }));
  assert.equal((disabled.match(/disabled=""/g) ?? []).length, 3);
});
