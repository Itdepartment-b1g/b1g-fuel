import assert from "node:assert/strict";
import { test } from "node:test";
import { getDatabaseErrorCode } from "../src/server/utils/errors";

test("database helpers extract the wrapped PostgreSQL code without HTTP decisions", () => {
  const failure = { message: "Failed SQL containing private values", cause: { code: "23505", detail: "private email" } };
  assert.equal(getDatabaseErrorCode(failure), "23505");
});

test("database code resolution handles unknown and cyclic causes", () => {
  const cyclic: { cause?: unknown } = {}; cyclic.cause = cyclic;
  assert.equal(getDatabaseErrorCode(cyclic), "");
  assert.equal(getDatabaseErrorCode(null), "");
  assert.equal(getDatabaseErrorCode(new Error("Unexpected database failure")), "");
  assert.equal(getDatabaseErrorCode({ cause: { cause: { code: "23503" } } }), "23503");
});
