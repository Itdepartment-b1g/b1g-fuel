import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient, type User, AuthApiError } from "@supabase/supabase-js";
import { verifyUserToken } from "../src/server/security/jwt";
import { UserError } from "../src/server/utils/errors";

const user = { id: "11111111-1111-4111-8111-111111111111", email: "approved@example.com" } as User;

test("cookie JWT verification uses the trusted Auth server result rather than decoded claims", async (t) => {
  const auth = createClient("http://localhost:56321", "test-key").auth;
  const getUser = t.mock.method(auth, "getUser", async () => ({ data: { user }, error: null }));
  assert.deepEqual(await verifyUserToken(auth), user);
  assert.deepEqual(getUser.mock.calls[0].arguments, []);
});

test("explicit JWT verification delegates to Supabase and malformed tokens never reach Auth", async (t) => {
  const auth = createClient("http://localhost:56321", "test-key").auth;
  const getUser = t.mock.method(auth, "getUser", async () => ({ data: { user }, error: null }));
  const token = "encoded_header.encoded_payload.signature";
  assert.deepEqual(await verifyUserToken(auth, token), user);
  assert.deepEqual(getUser.mock.calls[0].arguments, [token]);
  for (const malformed of ["", "not-a-jwt", "header.payload.", "Bearer header.payload.signature", " header.payload.signature", "header.payload.signature.extra", "x".repeat(16385)]) {
    await assert.rejects(verifyUserToken(auth, malformed), (error) => error instanceof UserError && error.code === "invalid_session");
  }
  assert.equal(getUser.mock.callCount(), 1);
});

test("expired or invalid signatures are rejected without exposing token or SDK error details", async (t) => {
  const auth = createClient("http://localhost:56321", "test-key").auth;
  const rejected = new AuthApiError("Sensitive internal Auth details", 401, "bad_jwt");
  t.mock.method(auth, "getUser", async () => ({ data: { user: null }, error: rejected }));
  await assert.rejects(verifyUserToken(auth, "header.payload.tampered"), (error) => {
    assert.ok(error instanceof UserError); assert.equal(error.code, "invalid_session"); assert.equal("status" in error, false);
    assert.equal(error.message, "Sign in to continue."); return true;
  });
});
