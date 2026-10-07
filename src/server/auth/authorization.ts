import type { RequestHandler } from "express";
import { authRepository } from "@/server/repositories/auth_repository";

export const requireSuperAdmin: RequestHandler = async (_req, res, next) => {
  const roles = await authRepository.findGlobalRoles(res.locals.user.id);
  if (!roles.some(({ role }) => role.slug === "super_admin")) {
    res.status(403).json({ error: "Super-admin access is required." });
    return;
  }
  next();
};
