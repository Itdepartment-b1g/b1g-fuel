import assert from "node:assert/strict";
import { test } from "node:test";
import type { AddressInfo } from "node:net";
import express from "express";
import { requireAuthUser } from "../src/server/auth/session";
import { createApp } from "../src/server/app";

async function serve(app: express.Express, run: (base: string) => Promise<void>) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try { await run(base); }
  finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

test("API boundaries: health, spec, missing session, CSRF, invalid bodies, and 404", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:56321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  process.env.APP_ORIGIN = "http://localhost:3000";
  const protectedApp = express();
  protectedApp.use((req, _res, next) => { req.cookies = {}; next(); });
  protectedApp.get("/protected", requireAuthUser, (_req, res) => res.json({ ok: true }));
  await serve(protectedApp, async (base) => { assert.equal((await fetch(`${base}/protected`)).status, 401); });
  await serve(createApp(), async (base) => {
    assert.equal((await fetch(`${base}/api/health`)).status, 200);
    const session = await fetch(`${base}/api/auth/session`);
    assert.equal(session.status, 401);
    assert.equal(session.headers.get("cache-control"), "private, no-store");
    for (const path of ["/api/users", "/api/users/options"]) {
      const response = await fetch(`${base}${path}`);
      assert.equal(response.status, 401);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
    }
    assert.equal((await fetch(`${base}/api/users`, { method: "POST", headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" }, body: "{}" })).status, 401);
    assert.equal((await fetch(`${base}/api/users`, { method: "POST" })).status, 403);
    assert.equal((await (await fetch(`${base}/api/openapi`)).json()).openapi, "3.0.3");
    for (const origin of [undefined, "https://other.example"]) {
      assert.equal((await fetch(`${base}/api/auth/login`, { method: "POST", headers: origin ? { Origin: origin } : {} })).status, 403);
    }
    const headers = { Origin: "http://localhost:3000", "Content-Type": "application/json" };
    assert.equal((await fetch(`${base}/api/auth/login`, { method: "POST", headers, body: "{" })).status, 400);
    assert.equal((await fetch(`${base}/api/auth/login`, { method: "POST", headers, body: JSON.stringify({ email: "bad", password: "short" }) })).status, 400);
    assert.equal((await fetch(`${base}/api/does-not-exist`)).status, 404);
    assert.equal((await fetch(`${base}/api/categories`)).status, 404);
    assert.equal((await fetch(`${base}/api/auth/signup`, { method: "POST", headers, body: JSON.stringify({ email: "test@example.com", password: "password123" }) })).status, 404);
  });
});
