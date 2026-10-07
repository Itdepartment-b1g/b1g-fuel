import type { RequestHandler } from "express";
import { authService } from "@/server/services/auth_service";
import { UserError } from "@/server/utils/errors";

export const requireSuperAdmin: RequestHandler = async (_req, res, next) => {
  try { await authService.requireSuperAdmin(res.locals.user.id); }
  catch (error) { if (error instanceof UserError) { res.status(error.status).json({ error: error.message }); return; } throw error; }
  next();
};
