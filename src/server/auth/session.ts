import type { RequestHandler } from "express";
import { createAuthClient } from "./supabase";
import { clearAuthSession } from "./clear-session";
import { authService } from "@/server/services/auth_service";
import { UserError } from "@/server/utils/errors";

export const requireAuthUser: RequestHandler = async (req, res, next) => {
  const auth = createAuthClient(req, res).auth;
  try {
    const { user, profile } = await authService.requireUserAccess(auth);
    res.locals.user = user; res.locals.profile = profile;
  } catch (error) {
    if (error instanceof UserError) {
      if (error.status === 403) await clearAuthSession(req, res, auth);
      res.status(error.status).json({ error: error.message }); return;
    }
    throw error;
  }
  next();
};
