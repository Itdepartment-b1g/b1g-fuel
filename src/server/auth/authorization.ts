import type { RequestHandler } from "express";
import { authService } from "@/server/services/auth_service";
import { respond_auth_error } from "@/server/controllers/auth_controller";

export const requireSuperAdmin: RequestHandler = async (_req, res, next) => {
  try { await authService.require_super_admin(res.locals.user.id); }
  catch (error) { respond_auth_error(error, res); return; }
  next();
};
