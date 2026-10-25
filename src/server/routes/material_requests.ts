import { Router } from "express";
import { requireAuthUser } from "@/server/auth/session";
import { loadRecordAccess, requirePermission } from "@/server/auth/record-access";
import * as controller from "@/server/controllers/material_requests_controller";

export const materialRequestsRouter = Router();
materialRequestsRouter.use((_req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });
materialRequestsRouter.use(requireAuthUser, loadRecordAccess);
materialRequestsRouter.get("/options", requirePermission("materialRequests", "view"), controller.get_material_request_options);
materialRequestsRouter.get("/filter-options", requirePermission("materialRequests", "view"), controller.get_material_request_filter_option);
materialRequestsRouter.get("/catalog", requirePermission("materialRequests", "view"), controller.get_material_request_catalog);
materialRequestsRouter.get("/receivings", requirePermission("materialRequestReceiving", "view"), controller.list_material_request_receipts);
materialRequestsRouter.get("/", requirePermission("materialRequests", "view"), (req, res) => req.query.id !== undefined ? controller.list_by_id_material_request(req, res) : controller.list_material_request(req, res));
materialRequestsRouter.post("/", requirePermission("materialRequests", "add"), controller.create_material_request);
materialRequestsRouter.patch("/", requirePermission("materialRequests", "edit"), controller.update_material_request);
materialRequestsRouter.post("/action", requirePermission("materialRequests", "edit"), controller.action_material_request);
materialRequestsRouter.post("/dispatch", requirePermission("materialRequests", "edit"), controller.dispatch_material_request);
materialRequestsRouter.post("/receive", requirePermission("materialRequests", "edit"), controller.receive_material_request);
