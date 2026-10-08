import { Router } from "express";
import { requireAuthUser } from "@/server/auth/session";
import { requireSuperAdmin } from "@/server/auth/authorization";
import {
  create_role,
  delete_role,
  edit_role,
  get_role_option,
  list_role,
  role_mutation_limiter,
  update_role,
} from "@/server/controllers/roles_controller";

export const rolesRouter = Router();
rolesRouter.use((_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});
rolesRouter.use(requireAuthUser, requireSuperAdmin);
rolesRouter.get("/options", get_role_option);
rolesRouter.get("/", (req, res) =>
  (req.query.id === undefined ? list_role : edit_role)(req, res),
);
rolesRouter.post("/", role_mutation_limiter, create_role);
rolesRouter.patch("/", role_mutation_limiter, update_role);
rolesRouter.delete("/", role_mutation_limiter, delete_role);
