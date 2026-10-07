import assert from "node:assert/strict";
import { test } from "node:test";
import type { AddressInfo } from "node:net";
import express from "express";
import { requireAuthUser } from "../src/server/auth/session";
import { createApp } from "../src/server/app";
import { authRepository } from "../src/server/repositories/auth_repository";

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
    const google = await fetch(`${base}/api/auth/google`, { method: "POST", headers });
    assert.equal(google.status, 200);
    assert.match(google.headers.get("set-cookie")!, /code-verifier=.*HttpOnly/i);
    const googleUrl = new URL((await google.json()).url);
    assert.equal(googleUrl.searchParams.get("provider"), "google");
    assert.equal(googleUrl.searchParams.get("redirect_to"), "http://localhost:3000/api/auth/google/callback");
    assert.equal(googleUrl.searchParams.get("code_challenge_method"), "s256");
    assert.ok(googleUrl.searchParams.get("code_challenge"));
    assert.equal((await fetch(`${base}/api/auth/google`, { method: "POST" })).status, 403);
    const callback = await fetch(`${base}/api/auth/google/callback?error=access_denied`, { redirect: "manual" });
    assert.equal(callback.status, 303);
    assert.equal(callback.headers.get("location"), "http://localhost:3000/login?auth_error=google_failed");
    assert.equal((await fetch(`${base}/api/auth/login`, { method: "POST", headers, body: "{" })).status, 400);
    assert.equal((await fetch(`${base}/api/auth/login`, { method: "POST", headers, body: JSON.stringify({ email: "bad", password: "short" }) })).status, 400);
    assert.equal((await fetch(`${base}/api/does-not-exist`)).status, 404);
    assert.equal((await fetch(`${base}/api/categories`)).status, 404);
    assert.equal((await fetch(`${base}/api/auth/signup`, { method: "POST", headers, body: JSON.stringify({ email: "test@example.com", password: "password123" }) })).status, 404);
  });
});

test("password login and protected requests require an existing profile and clear rejected sessions", async (t) => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  t.after(() => { if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl; });
  const profile = t.mock.method(authRepository, "findProfile", async (): Promise<{ id: string; name: string; email: string | null } | null> => null);
  const authUser = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", role: "authenticated", email: "approved@example.com", created_at: "2026-10-07T00:00:00Z", app_metadata: {}, user_metadata: {} };
  const jwt = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: authUser.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.test-signature`;
  const auth = express();
  auth.post("/auth/v1/token", (_req, res) => res.json({ access_token: jwt, refresh_token: "test-refresh", expires_in: 3600, token_type: "bearer", user: authUser }));
  auth.get("/auth/v1/user", (_req, res) => res.json(authUser));
  auth.post("/auth/v1/logout", (_req, res) => res.status(204).end());
  await serve(auth, async (authBase) => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = authBase;
    await serve(createApp(), async (base) => {
      const headers = { Origin: "http://localhost:3000", "Content-Type": "application/json" };
      const login = () => fetch(`${base}/api/auth/login`, { method: "POST", headers, body: JSON.stringify({ email: authUser.email, password: "test-password" }) });
      const denied = await login();
      assert.equal(denied.status, 403);
      assert.match(denied.headers.get("set-cookie")!, /Max-Age=0/i);
      profile.mock.mockImplementation(async () => ({ id: authUser.id, name: "Approved User", email: authUser.email }));
      const approved = await login();
      assert.equal(approved.status, 200);
      assert.equal((await approved.json()).user.name, "Approved User");
      const cookie = approved.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
      profile.mock.mockImplementation(async () => null);
      const session = await fetch(`${base}/api/auth/session`, { headers: { Cookie: cookie } });
      assert.equal(session.status, 403);
      assert.match(session.headers.get("set-cookie")!, /Max-Age=0/i);
    });
  });
});
