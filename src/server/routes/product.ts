import { Router } from "express";
import { requireAuthUser } from "@/server/auth/session";
import { loadRecordAccess, requirePermission } from "@/server/auth/record-access";
import {
  create_product,
  delete_product,
  get_product_filter_options,
  get_product_options,
  list_by_id_product,
  list_products,
  update_product,
} from "@/server/controllers/product_controller";

export const productsRouter = Router();
productsRouter.use((_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});
productsRouter.use(requireAuthUser, loadRecordAccess);
productsRouter.get("/options", requirePermission("products", "add"), get_product_options);
productsRouter.get(
  "/filter-options",
  requirePermission("products", "view"),
  get_product_filter_options,
);
productsRouter.get("/", requirePermission("products", "view"), (req, res) => {
  if (req.query.id !== undefined) return list_by_id_product(req, res);
  return list_products(req, res);
});
productsRouter.post("/", requirePermission("products", "add"), create_product);
productsRouter.patch("/", requirePermission("products", "edit"), update_product);
productsRouter.delete("/", requirePermission("products", "delete"), delete_product);
