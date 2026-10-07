import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";

test("dashboard rejects unprovisioned accounts and forwards cleared cookies", async (context) => {
  context.mock.method(globalThis, "fetch", async () => new Response(null, { status: 403, headers: { "Set-Cookie": "session=; Path=/; Max-Age=0" } }));
  const response = await proxy(new NextRequest("http://localhost:3000/dashboard"));
  assert.equal(response.headers.get("location"), "http://localhost:3000/login?auth_error=account_not_provisioned");
  assert.match(response.headers.get("set-cookie")!, /Max-Age=0/);
});

test("dashboard rejects missing sessions and forwards cleared cookies", async (context) => {
  context.mock.method(globalThis, "fetch", async () => new Response(null, { status: 401, headers: { "Set-Cookie": "session=; Path=/; Max-Age=0" } }));
  const response = await proxy(new NextRequest("http://localhost:3000/dashboard"));
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "http://localhost:3000/login");
  assert.match(response.headers.get("set-cookie")!, /Max-Age=0/);
});

test("dashboard verifies through Express and forwards refreshed cookies", async (context) => {
  const mockFetch = context.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ user: { id: "user-id" } }), { status: 200, headers: { "Set-Cookie": "session=refreshed; Path=/; HttpOnly" } }));
  const response = await proxy(new NextRequest("http://localhost:3000/dashboard", { headers: { Cookie: "session=old" } }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-middleware-next"), "1");
  assert.match(response.headers.get("set-cookie")!, /session=refreshed/);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const options = mockFetch.mock.calls[0].arguments[1] as RequestInit;
  assert.equal(new Headers(options.headers).get("cookie"), "session=old");
  assert.equal(options.cache, "no-store");
});

test("dashboard fails closed when the authentication service is unavailable", async (context) => {
  context.mock.method(globalThis, "fetch", async () => { throw new Error("API offline"); });
  assert.equal((await proxy(new NextRequest("http://localhost:3000/dashboard"))).status, 503);
});
