import { Router } from "express";
import { requireAuthUser } from "@/server/auth/session";
import { requireSuperAdmin } from "@/server/auth/authorization";
import { createRole, deleteRole, editRole, getRoleOption, listRole, roleMutationLimiter, updateRole } from "@/server/controllers/roles_controller";

export const rolesRouter = Router();
rolesRouter.use((_req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });
rolesRouter.use(requireAuthUser, requireSuperAdmin);
rolesRouter.get("/options", getRoleOption);
rolesRouter.get("/", (req, res, next) => (req.query.id === undefined ? listRole : editRole)(req, res, next));
rolesRouter.post("/", roleMutationLimiter, createRole);
rolesRouter.patch("/", roleMutationLimiter, updateRole);
rolesRouter.delete("/", roleMutationLimiter, deleteRole);
