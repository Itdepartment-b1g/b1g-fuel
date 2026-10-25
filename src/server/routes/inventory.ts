import { Router } from "express";
import { requireAuthUser } from "@/server/auth/session";
import { loadRecordAccess, requirePermission } from "@/server/auth/record-access";
import * as controller from "@/server/controllers/inventory_controller";

export const inventoryRouter = Router();
inventoryRouter.use((_req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });
inventoryRouter.use(requireAuthUser, loadRecordAccess, requirePermission("inventory", "view"));
inventoryRouter.get("/filter-options", controller.get_inventory_filter_option);
inventoryRouter.get("/brands", controller.list_inventory_brand);
inventoryRouter.get("/history", controller.get_inventory_history);
inventoryRouter.get("/export", controller.export_inventory_history);
inventoryRouter.get("/movements", controller.list_stock_movement);
inventoryRouter.get("/", (req, res) => req.query.id === undefined ? controller.list_inventory(req, res) : controller.list_by_id_inventory(req, res));
