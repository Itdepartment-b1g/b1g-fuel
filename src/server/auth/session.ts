import type { RequestHandler } from "express";
import { createAuthClient } from "./supabase";
import { clearAuthSession } from "./clear-session";
import { authService } from "@/server/services/auth_service";
import { UserError } from "@/server/services/users_service";
import { respond_auth_error } from "@/server/controllers/auth_controller";

export const requireAuthUser: RequestHandler = async (req, res, next) => {
  const auth = createAuthClient(req, res).auth;
  try {
    const { user, profile } = await authService.require_user_access(auth);
    res.locals.user = user; res.locals.profile = profile;
  } catch (error) {
    if (error instanceof UserError && error.code === "account_not_provisioned")
      await clearAuthSession(req, res, auth);
    respond_auth_error(error, res);
    return;
  }
  next();
};
