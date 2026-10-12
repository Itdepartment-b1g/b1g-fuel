import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePagination, paginationMetadata, PaginationError } from "../src/server/lib/pagination";
import { createPaginationMetadata, paginateItems, mobilePageNumbers, paginationFromApi, pageNavigation, DEFAULT_LIMIT_OPTIONS } from "../src/lib/pagination";

test("number navigation ignores current/invalid pages and only permits adjacent fallback callbacks", () => {
  const metadata = createPaginationMetadata(100, 5, 10);
  assert.equal(pageNavigation(1, metadata, true), "page");
  assert.equal(pageNavigation(1, metadata, false), null);
  assert.equal(pageNavigation(4, metadata, false), "prev");
  assert.equal(pageNavigation(6, metadata, false), "next");
  for (const target of [0, 5, 11, 2.5, NaN]) assert.equal(pageNavigation(target, metadata, true), null);
  assert.equal(pageNavigation(6, metadata, true, true), null);
  assert.equal(pageNavigation(1, createPaginationMetadata(0), true), null);
});

test("array pagination returns metadata, defaults to 10, clamps pages and never mutates input", () => {
  const items = Object.freeze(Array.from({ length: 27 }, (_, index) => index + 1));
  assert.deepEqual(paginateItems(items, 2), { items: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20], page: 2, limit: 10, total: 27, total_pages: 3, has_next_page: true, has_prev_page: true });
  assert.equal(paginateItems(items, -4).page, 1);
  const last = paginateItems(items, 999);
  assert.deepEqual(last.items, [21, 22, 23, 24, 25, 26, 27]);
  assert.equal(last.page, 3); assert.equal(last.has_next_page, false);
  assert.equal(paginateItems(items, Infinity).page, 3); assert.equal(paginateItems(items, NaN).page, 1);
  assert.equal(items.length, 27);
});

test("empty pagination has page 1, zero pages and disabled navigation; limits must be positive integers", () => {
  assert.deepEqual(paginateItems([], 10), { items: [], page: 1, limit: 10, total: 0, total_pages: 0, has_next_page: false, has_prev_page: false });
  assert.deepEqual(mobilePageNumbers(1, 0), [1]);
  for (const limit of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => paginateItems([], 1, limit), /positive integer/);
  assert.equal(paginateItems([1, 2], 1, 5).limit, 5);
  assert.deepEqual(DEFAULT_LIMIT_OPTIONS, [5, 10, 20, 50]);
});

test("mobile numbers follow exact first, middle and last rules", () => {
  assert.deepEqual(mobilePageNumbers(1, 1), [1]); assert.deepEqual(mobilePageNumbers(3, 5), [1, 2, 3, 4, 5]);
  for (const page of [1, 2, 3]) assert.deepEqual(mobilePageNumbers(page, 10), [1, 2, 3, "ellipsis", 10]);
  for (const page of [8, 9, 10]) assert.deepEqual(mobilePageNumbers(page, 10), [1, "ellipsis", 8, 9, 10]);
  assert.deepEqual(mobilePageNumbers(5, 10), [1, "ellipsis", 4, 5, 6, "ellipsis", 10]);
  assert.deepEqual(mobilePageNumbers(4, 7), [1, "ellipsis", 3, 4, 5, "ellipsis", 7]);
});

test("filter/sort precede slicing and reduced API totals clamp the current page", () => {
  const records = [9, 8, 7, 6, 5, 4, 3, 2, 1].filter((value) => value % 2).sort((a, b) => a - b);
  assert.deepEqual(paginateItems(records, 2, 2).items, [5, 7]);
  assert.equal(createPaginationMetadata(11, 4, 10).page, 2);
  assert.deepEqual(paginationFromApi({ page: 3, page_size: 10, total: 11 }), { page: 2, limit: 10, total: 11, total_pages: 2, has_next_page: false, has_prev_page: true });
});

test("pagination provides defaults, database offsets and compatible response metadata", () => {
  assert.deepEqual(parsePagination({}), { page: 1, page_size: 10, skip: 0, take: 10 });
  const pagination = parsePagination({ page: "3", page_size: "10" });
  assert.deepEqual(pagination, { page: 3, page_size: 10, skip: 20, take: 10 });
  assert.deepEqual(paginationMetadata(25, pagination), { total: 25, page: 3, page_size: 10 });
  assert.deepEqual(paginationMetadata(0, parsePagination({})), { total: 0, page: 1, page_size: 10 });
  for (const size of [10, 20, 50, 100]) assert.equal(parsePagination({ page_size: String(size) }).take, size);
  assert.equal(parsePagination({ page: "1000000" }).skip, 9_999_990);
});

test("pagination rejects malformed, repeated, nested and out-of-range query values", () => {
  for (const value of ["", "0", "-1", "1.5", "1e2", " 1", "1 ", "01", "Infinity", "9007199254740992", ["1", "2"], {}, null, 1]) {
    for (const key of ["page", "page_size"]) {
      assert.throws(() => parsePagination({ [key]: value }), (error) => error instanceof PaginationError);
    }
  }
  assert.throws(() => parsePagination({ page_size: "101" }), PaginationError);
  for (const size of [1, 5, 15, 25, 99]) assert.throws(() => parsePagination({ page_size: String(size) }), PaginationError);
  assert.throws(() => parsePagination({ page: "1000001" }), PaginationError);
});

test("endpoint-specific limits are validated and cannot produce unsafe offsets", () => {
  const options = { defaultPageSize: 20, maxPageSize: 50, maxPage: 50 };
  assert.deepEqual(parsePagination({}, options), { page: 1, page_size: 20, skip: 0, take: 20 });
  assert.throws(() => parsePagination({ page: "51" }, options), PaginationError);
  assert.throws(() => parsePagination({ page_size: "11" }, options), PaginationError);
  assert.throws(() => parsePagination({ page_size: "100" }, options), PaginationError);
  for (const invalid of [{ defaultPageSize: 0 }, { defaultPageSize: 5 }, { maxPage: -1 }, { maxPageSize: 1.5 }, { defaultPageSize: 101 }, { maxPage: Infinity }, { defaultPageSize: 50, maxPageSize: 20 }]) {
    assert.throws(() => parsePagination({}, invalid), /Invalid pagination configuration/);
  }
  assert.throws(() => parsePagination({ page: String(Number.MAX_SAFE_INTEGER), page_size: "100" }, { maxPage: Number.MAX_SAFE_INTEGER }), PaginationError);
});
