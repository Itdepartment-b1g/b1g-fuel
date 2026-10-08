import { PAGE_CATALOG } from "@/lib/auth/catalog";
import { PERMISSION_CATALOG } from "@/lib/auth/permissions";
import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import { requireAuthUser } from "@/server/auth/session";
import { requireSuperAdmin } from "@/server/auth/authorization";
import {
  create_role,
  delete_role,
  list_by_id_role,
  list_role,
  update_role,
} from "@/server/controllers/roles_controller";

const role_mutation_limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: "Too many role changes. Try again later." });
  },
});

export const rolesRouter = Router();
rolesRouter.use((_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});
rolesRouter.use(requireAuthUser, requireSuperAdmin);
rolesRouter.get("/options", (_req, res) => {
  res.status(200).json({ scopes: ["company", "global"], pages: PAGE_CATALOG.map(({ key, label, href }) => ({ key, label, href })), permissions: [...PERMISSION_CATALOG] });
});
rolesRouter.get("/", (req, res) =>
  (req.query.id === undefined ? list_role : list_by_id_role)(req, res),
);
rolesRouter.post("/", role_mutation_limiter, create_role);
rolesRouter.patch("/", role_mutation_limiter, update_role);
rolesRouter.delete("/", role_mutation_limiter, delete_role);
