import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";
import { create_role } from "../src/server/controllers/roles_controller";
import * as rolesService from "../src/server/services/roles_service";

async function error_response(error: unknown) {
  let status = 200;
  let body: unknown;
  const res = { status(code: number) { status = code; return this; }, json(value: unknown) { body = value; } } as unknown as Response;
  const service = { ...rolesService, create_role: async () => { throw error; } };
  await create_role({ body: { name: "Manager" } } as Request, res, undefined, service);
  return { status, body };
}

test("controller maps wrapped PostgreSQL conflicts without exposing private details", async () => {
  const failure = { message: "Failed SQL containing private values", cause: { code: "23505", detail: "private email" } };
  const result = await error_response(failure);
  assert.equal(result.status, 409);
  assert.equal(JSON.stringify(result.body).includes("private"), false);
});

test("Prisma database conflicts preserve controller error handling", async () => {
  for (const [failure, status] of [
    [{ code: "P2002" }, 409],
    [{ code: "P2003" }, 409],
    [{ code: "P2004" }, 400],
    [{ code: "P2010", meta: { code: "23503" } }, 409],
    [{ code: "P2039", meta: { driverAdapterError: { cause: { originalCode: "23514" } } } }, 400],
  ] as const) assert.equal((await error_response(failure)).status, status);
});

test("controller handles unknown and cyclic database failures safely", async (t) => {
  t.mock.method(console, "error", () => {});
  const cyclic: { cause?: unknown } = {}; cyclic.cause = cyclic;
  for (const failure of [cyclic, null, new Error("Unexpected database failure")])
    assert.deepEqual(await error_response(failure), { status: 500, body: { error: "The request could not be completed." } });
  assert.equal((await error_response({ cause: { cause: { code: "23503" } } })).status, 409);
});
