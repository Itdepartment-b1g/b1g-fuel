import type { RequestHandler } from "express";
import { createAuthClient } from "@/server/auth/supabase";
import { authRepository } from "@/server/repositories/auth_repository";

export const getSession: RequestHandler = async (_req, res) => {
  const user = res.locals.user;
  const roles = await authRepository.findGlobalRoles(user.id);
  const name = [user.user_metadata?.full_name, user.user_metadata?.name]
    .find((value) => typeof value === "string" && value.trim());
  res.json({ user: { id: user.id, email: user.email, name: name?.trim() ?? null }, global_roles: roles.map(({ role }) => role.slug) });
};

export const authenticate: RequestHandler = async (req, res) => {
  const { action } = req.params;
  if (action !== "login" && action !== "logout") { res.status(404).json({ error: "Unknown authentication action." }); return; }
  if (action === "logout") {
    const { error } = await createAuthClient(req, res).auth.signOut();
    if (error) { res.status(400).json({ error: "Unable to sign out." }); return; }
    res.json({ message: "Signed out." }); return;
  }
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Provide a valid email and a password of at least 8 characters." }); return;
  }
  const client = createAuthClient(req, res);
  const credentials = { email: email.trim(), password };
  const { data, error } = await client.auth.signInWithPassword(credentials);
  if (error) { res.status(401).json({ error: "Invalid email or password." }); return; }
  if (data.user && data.session) await authRepository.upsertFromAuth(data.user.id, data.user.email);
  res.json({
    user: data.session && data.user ? { id: data.user.id, email: data.user.email } : null,
    message: "Signed in.",
  });
};
