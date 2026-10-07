import assert from "node:assert/strict";
import { test } from "node:test";
import type { AddressInfo } from "node:net";
import { createApp } from "../src/server/app";
import { getAppOrigin } from "../src/server/security/middleware";

test("application origin is canonical and rejects unsupported or non-origin configuration", (t) => {
  const previous = process.env.APP_ORIGIN;
  t.after(() => { if (previous === undefined) delete process.env.APP_ORIGIN; else process.env.APP_ORIGIN = previous; });
  delete process.env.APP_ORIGIN; assert.equal(getAppOrigin(), "http://localhost:3000");
  process.env.APP_ORIGIN = "https://EXAMPLE.COM:443/"; assert.equal(getAppOrigin(), "https://example.com");
  for (const origin of ["invalid", "ftp://example.com", "https://user:password@example.com", "https://example.com/path", "https://example.com/?x=1", "https://example.com/#section"]) {
    process.env.APP_ORIGIN = origin;
    assert.throws(getAppOrigin, /Invalid APP_ORIGIN configuration/);
    assert.throws(createApp, /Invalid APP_ORIGIN configuration/);
  }
});

test("origin middleware permits credentialed requests/preflights only from APP_ORIGIN and protects mutations", async (t) => {
  const previous = process.env.APP_ORIGIN;
  t.after(() => { if (previous === undefined) delete process.env.APP_ORIGIN; else process.env.APP_ORIGIN = previous; });
  process.env.APP_ORIGIN = "http://localhost:3000/";
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
  const allowed = await fetch(`${base}/api/health`, { headers: { Origin: "http://localhost:3000" } });
  assert.equal(allowed.headers.get("access-control-allow-origin"), "http://localhost:3000");
  assert.equal(allowed.headers.get("access-control-allow-credentials"), "true");
  assert.match(allowed.headers.get("vary")!, /Origin/);
  const badOrigin = await fetch(`${base}/api/health`, { headers: { Origin: "https://other.example" } });
  assert.equal(badOrigin.status, 403); assert.equal(badOrigin.headers.get("access-control-allow-origin"), null);
  for (const origin of [undefined, "null", "https://other.example", "http://localhost:3001"]) {
    const mutation = await fetch(`${base}/api/auth/logout`, { method: "POST", headers: origin === undefined ? {} : { Origin: origin } });
    assert.equal(mutation.status, 403);
  }
  const headers = { Origin: "http://localhost:3000", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "Content-Type" };
  const preflight = await fetch(`${base}/api/auth/login`, { method: "OPTIONS", headers });
  assert.equal(preflight.status, 204); assert.match(preflight.headers.get("access-control-allow-methods")!, /POST/);
  assert.equal(preflight.headers.get("access-control-allow-headers"), "Content-Type");
  assert.equal(preflight.headers.get("access-control-allow-credentials"), "true");
  assert.equal((await fetch(`${base}/api/auth/login`, { method: "OPTIONS", headers: { ...headers, Origin: "https://other.example" } })).status, 403);
  assert.equal((await fetch(`${base}/api/auth/login`, { method: "OPTIONS", headers: { ...headers, "Access-Control-Request-Method": "TRACE" } })).status, 403);
  assert.equal((await fetch(`${base}/api/auth/login`, { method: "OPTIONS", headers: { ...headers, "Access-Control-Request-Headers": "X-Unapproved" } })).status, 403);
});
