import { Router } from "express";
import { requireAuthUser } from "@/server/auth/session";
import { loadRecordAccess, requirePermission } from "@/server/auth/record-access";
import {
  create_product_type,
  delete_product_type,
  get_product_type_filter_options,
  get_product_type_options,
  list_by_id_product_type,
  list_product_types,
  update_product_type,
} from "@/server/controllers/product_type_controller";

export const productTypesRouter = Router();
productTypesRouter.use((_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});
productTypesRouter.use(requireAuthUser, loadRecordAccess);
productTypesRouter.get(
  "/options",
  requirePermission("productTypes", "add"),
  get_product_type_options,
);
productTypesRouter.get(
  "/filter-options",
  requirePermission("productTypes", "view"),
  get_product_type_filter_options,
);
productTypesRouter.get("/", requirePermission("productTypes", "view"), (req, res) => {
  if (req.query.id !== undefined) return list_by_id_product_type(req, res);
  return list_product_types(req, res);
});
productTypesRouter.post("/", requirePermission("productTypes", "add"), create_product_type);
productTypesRouter.patch("/", requirePermission("productTypes", "edit"), update_product_type);
productTypesRouter.delete("/", requirePermission("productTypes", "delete"), delete_product_type);
