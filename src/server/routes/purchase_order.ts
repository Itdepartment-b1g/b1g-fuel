import { Router } from "express";
import { requireAuthUser } from "@/server/auth/session";
import { loadRecordAccess, requirePermission } from "@/server/auth/record-access";
import {
  close_purchase_order,
  confirm_purchase_order,
  create_purchase_order,
  delete_purchase_order,
  get_purchase_order_filter_options,
  get_purchase_order_options,
  list_by_id_purchase_order,
  list_purchase_orders,
  update_purchase_order,
} from "@/server/controllers/purchase_order_controller";

export const purchaseOrdersRouter = Router();
purchaseOrdersRouter.use((_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});
purchaseOrdersRouter.use(requireAuthUser, loadRecordAccess);
purchaseOrdersRouter.get(
  "/options",
  requirePermission("purchaseOrders", "view"),
  get_purchase_order_options,
);
purchaseOrdersRouter.get(
  "/filter-options",
  requirePermission("purchaseOrders", "view"),
  get_purchase_order_filter_options,
);
purchaseOrdersRouter.get("/", requirePermission("purchaseOrders", "view"), (req, res) => {
  if (req.query.id !== undefined) return list_by_id_purchase_order(req, res);
  return list_purchase_orders(req, res);
});
purchaseOrdersRouter.post("/", requirePermission("purchaseOrders", "add"), create_purchase_order);
purchaseOrdersRouter.post(
  "/confirm",
  requirePermission("purchaseOrders", "edit"),
  confirm_purchase_order,
);
purchaseOrdersRouter.post(
  "/close",
  requirePermission("purchaseOrders", "edit"),
  close_purchase_order,
);
purchaseOrdersRouter.patch(
  "/",
  requirePermission("purchaseOrders", "edit"),
  update_purchase_order,
);
purchaseOrdersRouter.delete(
  "/",
  requirePermission("purchaseOrders", "delete"),
  delete_purchase_order,
);
