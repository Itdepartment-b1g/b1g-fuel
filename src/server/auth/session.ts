import type { RequestHandler } from "express";
import { createAuthClient } from "./supabase";
import { clearAuthSession } from "./clear-session";
import { authRepository } from "@/server/repositories/auth_repository";

export const requireAuthUser: RequestHandler = async (req, res, next) => {
  const auth = createAuthClient(req, res).auth;
  const { data: { user }, error } = await auth.getUser();
  if (error || !user) { res.status(401).json({ error: "Sign in to continue." }); return; }
  const profile = await authRepository.findProfile(user.id);
  if (!profile) {
    await clearAuthSession(req, res, auth);
    res.status(403).json({ error: "Your account has not been provisioned. Contact your administrator." }); return;
  }
  res.locals.user = user;
  res.locals.profile = profile;
  next();
};
