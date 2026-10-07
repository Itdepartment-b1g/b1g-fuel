import assert from "node:assert/strict";
import { test } from "node:test";
import { configureStore, type Middleware } from "@reduxjs/toolkit";
import { makeStore } from "../src/lib/store/store";
import { authReducer, login, startGoogleLogin, resetAuth } from "../src/lib/store/auth-slice";
import { usersReducer } from "../src/lib/store/users-slice";

const input = { email: "user@example.com", password: "private-app-password" };
const user = { id: "approved-user", name: "Juan", email: input.email };

test("password login uses cookies and retains identity without passwords or tokens in actions/state", async (t) => {
  const actions: unknown[] = [];
  const recorder: Middleware = () => (next) => (action) => { actions.push(action); return next(action); };
  const store = configureStore({ reducer: { auth: authReducer, users: usersReducer }, middleware: (getDefault) => getDefault().concat(recorder) });
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ user, message: "Signed in.", access_token: "must-not-be-stored" })));
  assert.deepEqual(await store.dispatch(login(input)), { user, message: "Signed in." });
  const args = fetch.mock.calls[0].arguments as unknown as [string, RequestInit];
  assert.equal(args[0], "/api/auth/login");
  assert.equal(args[1].credentials, "include");
  assert.deepEqual(JSON.parse(String(args[1].body)), input);
  assert.deepEqual(store.getState().auth.user, user);
  assert.equal(store.getState().auth.status, "succeeded");
  for (const output of [JSON.stringify(actions), JSON.stringify(store.getState())]) {
    assert.equal(output.includes(input.password), false);
    assert.equal(output.includes("must-not-be-stored"), false);
  }
});

test("Google initiation returns its URL without storing it and rejects invalid redirect responses", async (t) => {
  const store = makeStore();
  const url = "https://auth.example.com/auth/v1/authorize?code_challenge=test";
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ url })));
  assert.deepEqual(await store.dispatch(startGoogleLogin()), { url });
  const args = fetch.mock.calls[0].arguments as unknown as [string, RequestInit];
  assert.equal(args[0], "/api/auth/google"); assert.equal(args[1].credentials, "include");
  assert.equal(store.getState().auth.operation, "google");
  assert.equal(JSON.stringify(store.getState()).includes(url), false);
  fetch.mock.mockImplementation(async () => new Response(JSON.stringify({ url: "javascript:alert(1)" })));
  await assert.rejects(store.dispatch(startGoogleLogin()));
  assert.equal(store.getState().auth.status, "failed");
});

test("auth preserves HTTP errors and recovers after malformed or unavailable responses", async (t) => {
  const store = makeStore();
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ error: "Invalid email or password." }), { status: 401 }));
  await assert.rejects(store.dispatch(login(input)));
  assert.equal(store.getState().auth.error?.status, 401);
  assert.equal(store.getState().auth.error?.message, "Invalid email or password.");
  fetch.mock.mockImplementation(async () => new Response("not-json"));
  await assert.rejects(store.dispatch(login(input)));
  assert.match(store.getState().auth.error!.message, /unreadable/);
  fetch.mock.mockImplementation(async () => { throw new TypeError("network failure"); });
  await assert.rejects(store.dispatch(startGoogleLogin()));
  assert.equal(store.getState().auth.error?.status, 0);
  fetch.mock.mockImplementation(async () => new Response(JSON.stringify({ user, message: "Signed in." })));
  await store.dispatch(login(input));
  assert.equal(store.getState().auth.error, null);
});

test("auth prevents concurrent login methods and ignores reset requests' late responses", async (t) => {
  const store = makeStore();
  let resolve!: (response: Response) => void;
  const fetch = t.mock.method(globalThis, "fetch", async () => new Promise<Response>((done) => { resolve = done; }));
  const pending = store.dispatch(login(input));
  assert.equal(store.getState().auth.status, "loading");
  await assert.rejects(store.dispatch(startGoogleLogin()));
  assert.equal(fetch.mock.callCount(), 1);
  store.dispatch(resetAuth());
  resolve(new Response(JSON.stringify({ user, message: "Signed in." })));
  await assert.rejects(pending);
  assert.equal(store.getState().auth.status, "idle");
  assert.equal(store.getState().auth.user, null);
});
