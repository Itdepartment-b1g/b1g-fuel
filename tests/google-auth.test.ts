import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { Request, Response } from "express";
import { createClient, type User, type Session } from "@supabase/supabase-js";
import { create_google_controller } from "../src/server/controllers/google_auth_controller";
import { clearAuthSession } from "../src/server/auth/clear-session";

const user = { id: "approved-user" } as User;
const session = { user } as Session;
function setOrigin(t: TestContext, value: string) {
  const previous = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = value;
  t.after(() => { if (previous === undefined) delete process.env.APP_ORIGIN; else process.env.APP_ORIGIN = previous; });
}
function response() {
  const result = { status: 200, body: undefined as unknown, location: "", headers: {} as Record<string, string>, cleared: [] as string[] };
  const res = {
    status(code: number) { result.status = code; return this; },
    json(body: unknown) { result.body = body; return this; },
    redirect(code: number, url: string) { result.status = code; result.location = url; return this; },
    set(name: string, value: string) { result.headers[name] = value; return this; },
    clearCookie(name: string) { result.cleared.push(name); return this; },
  } as unknown as Response;
  return { result, res };
}

test("Google initiation uses a trusted callback and returns the provider URL", async (t) => {
  setOrigin(t, "http://localhost:3000");
  const auth = createClient("http://localhost:56321", "test-key").auth;
  const start = t.mock.method(auth, "signInWithOAuth", async () => ({ data: { provider: "google", url: "http://localhost:56321/auth/v1/authorize?provider=google" }, error: null }));
  const handlers = create_google_controller({ auth_client: () => auth, get_user_profile: async () => null });
  const { res, result } = response();
  await handlers.start_google_login({ query: { next: "https://other.example" } } as unknown as Request, res, () => {});
  const options = (start.mock.calls[0].arguments as unknown as [{ options: { redirectTo: string; skipBrowserRedirect: boolean } }])[0].options;
  assert.equal(options.redirectTo, "http://localhost:3000/api/auth/google/callback");
  assert.equal(options.skipBrowserRedirect, true);
  assert.deepEqual(result.body, { url: "http://localhost:56321/auth/v1/authorize?provider=google" });
});

test("Google callback verifies identity, preserves profile and redirects only to the trusted dashboard", async (t) => {
  setOrigin(t, "https://fuel.example.com");
  const auth = createClient("http://localhost:56321", "test-key").auth;
  const exchange = t.mock.method(auth, "exchangeCodeForSession", async () => ({ data: { user, session }, error: null }));
  t.mock.method(auth, "getUser", async () => ({ data: { user }, error: null }));
  const profiles = t.mock.fn(async (id: string) => ({ id, name: "Juan", email: "juan@example.com" }));
  const handlers = create_google_controller({ auth_client: () => auth, get_user_profile: profiles });
  const { res, result } = response();
  await handlers.finish_google_login({ query: { code: "test-code", next: "https://other.example" }, cookies: {} } as unknown as Request, res, () => {});
  assert.deepEqual(exchange.mock.calls[0].arguments, ["test-code"]);
  assert.deepEqual(profiles.mock.calls[0].arguments, [user.id]);
  assert.equal(result.status, 303); assert.equal(result.location, "https://fuel.example.com/dashboard");
  assert.equal(result.headers["Referrer-Policy"], "no-referrer");
});

test("Google callback rejects missing/repeated codes and canceled flows without exchanging", async (t) => {
  setOrigin(t, "http://localhost:3000");
  const factory = t.mock.fn(() => createClient("http://localhost:56321", "test-key").auth);
  const handlers = create_google_controller({ auth_client: factory, get_user_profile: async () => null });
  for (const query of [{}, { code: ["a", "b"] }, { code: "" }, { error: "access_denied", error_description: "unsafe message" }]) {
    const { res, result } = response();
    await handlers.finish_google_login({ query } as unknown as Request, res, () => {});
    assert.equal(result.location, "http://localhost:3000/login?auth_error=google_failed");
  }
  assert.equal(factory.mock.callCount(), 0);
});

test("unprovisioned OAuth accounts are rejected and auth cookies are cleared even if revocation fails", async (t) => {
  setOrigin(t, "http://localhost:3000");
  const auth = createClient("http://localhost:56321", "test-key").auth;
  t.mock.method(auth, "exchangeCodeForSession", async () => ({ data: { user, session }, error: null }));
  t.mock.method(auth, "getUser", async () => ({ data: { user }, error: null }));
  const revoke = t.mock.method(auth, "signOut", async () => { throw new Error("Auth unavailable"); });
  const handlers = create_google_controller({ auth_client: () => auth, get_user_profile: async () => null });
  const req = { query: { code: "test-code" }, cookies: { "sb-local-auth-token.0": "session", "sb-local-auth-token-code-verifier": "verifier", unrelated: "keep" } } as unknown as Request;
  const { res, result } = response();
  await handlers.finish_google_login(req, res, () => {});
  assert.equal(result.location, "http://localhost:3000/login?auth_error=account_not_provisioned");
  assert.deepEqual(revoke.mock.calls[0].arguments, [{ scope: "local" }]);
  assert.deepEqual(result.cleared, ["sb-local-auth-token.0", "sb-local-auth-token-code-verifier"]);
});

test("disabled Google signup displays the organization access notice without starting a session", async (t) => {
  setOrigin(t, "http://localhost:3000");
  const factory = t.mock.fn(() => createClient("http://localhost:56321", "test-key").auth);
  const handlers = create_google_controller({ auth_client: factory, get_user_profile: async () => null });
  const { res, result } = response();
  await handlers.finish_google_login({ query: { error: "access_denied", error_code: "signup_disabled", error_description: "Signups not allowed" } } as unknown as Request, res, () => {});
  assert.equal(result.location, "http://localhost:3000/login?auth_error=account_not_provisioned");
  assert.equal(factory.mock.callCount(), 0);
});

test("failed exchanges return a fixed error and clear the browser session", async (t) => {
  setOrigin(t, "http://localhost:3000");
  const auth = createClient("http://localhost:56321", "test-key").auth;
  t.mock.method(auth, "exchangeCodeForSession", async () => { throw new Error("expired code with sensitive details"); });
  t.mock.method(auth, "signOut", async () => ({ error: null }));
  const handlers = create_google_controller({ auth_client: () => auth, get_user_profile: async () => null });
  const { res, result } = response();
  await handlers.finish_google_login({ query: { code: "expired" }, cookies: { "sb-local-auth-token": "token" } } as unknown as Request, res, () => {});
  assert.equal(result.location, "http://localhost:3000/login?auth_error=google_failed");
  assert.deepEqual(result.cleared, ["sb-local-auth-token"]);
  await clearAuthSession({ cookies: {} } as Request, res, auth);
});
