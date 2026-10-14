import { loadRecordAccess, requirePermission } from "@/server/auth/record-access";
import { PAGE_CATALOG } from "@/lib/auth/catalog";
import { PERMISSION_CATALOG } from "@/lib/auth/permissions";
import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import { requireAuthUser } from "@/server/auth/session";
import { requireSuperAdmin } from "@/server/auth/authorization";
import { getDatabase } from "@/server/lib/database";
import {
  get_role_filter_option,
  create_role,
  delete_role,
  list_by_id_role,
  list_role,
  list_role_assignments,
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
rolesRouter.use(requireAuthUser, loadRecordAccess);
rolesRouter.get("/assignments", requirePermission("roles", "view"), requirePermission("users", "view"), list_role_assignments);
rolesRouter.get("/options", requireSuperAdmin, async (_req, res) => {
  const companies = await getDatabase().company.findMany({ select: { id: true, name: true }, orderBy: [{ name: "asc" }, { id: "asc" }] });
  res.status(200).json({ companies, scopes: ["company", "global"], pages: PAGE_CATALOG.map(({ key, label, href }) => ({ key, label, href })), permissions: [...PERMISSION_CATALOG] });
});
rolesRouter.get("/filter-options", requirePermission("roles", "view"), get_role_filter_option);
rolesRouter.get("/", requirePermission("roles", "view"), (req, res) =>
  (req.query.id === undefined ? list_role : list_by_id_role)(req, res),
);
rolesRouter.post("/", requireSuperAdmin, role_mutation_limiter, create_role);
rolesRouter.patch("/", requireSuperAdmin, role_mutation_limiter, update_role);
rolesRouter.delete("/", requireSuperAdmin, role_mutation_limiter, delete_role);
