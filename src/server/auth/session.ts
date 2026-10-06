import type { RequestHandler } from "express";
import { createAuthClient } from "./supabase";

export const requireAuthUser: RequestHandler = async (req, res, next) => {
  const { data: { user }, error } = await createAuthClient(req, res).auth.getUser();
  if (error || !user) { res.status(401).json({ error: "Sign in to continue." }); return; }
  res.locals.user = user;
  next();
};
