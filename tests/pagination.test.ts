import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePagination, paginationMetadata, PaginationError } from "../src/server/utils/pagination";

test("pagination provides defaults, Prisma offsets and compatible response metadata", () => {
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
      assert.throws(() => parsePagination({ [key]: value }), (error) => error instanceof PaginationError && error.status === 400);
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
