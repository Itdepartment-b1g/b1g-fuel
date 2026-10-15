import { Router } from "express";
import { requireAuthUser } from "@/server/auth/session";
import { loadRecordAccess, requirePermission } from "@/server/auth/record-access";
import {
  create_supplier,
  delete_supplier,
  list_by_id_supplier,
  list_suppliers,
  update_supplier,
} from "@/server/controllers/supplier_controller";

export const suppliersRouter = Router();
suppliersRouter.use((_req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });
suppliersRouter.use(requireAuthUser, loadRecordAccess);
suppliersRouter.get("/", requirePermission("suppliers", "view"), (req, res) => {
  if (req.query.id !== undefined) return list_by_id_supplier(req, res);
  return list_suppliers(req, res);
});
suppliersRouter.post("/", requirePermission("suppliers", "add"), create_supplier);
suppliersRouter.patch("/", requirePermission("suppliers", "edit"), update_supplier);
suppliersRouter.delete("/", requirePermission("suppliers", "delete"), delete_supplier);
