import { Router } from "express";
import { requireAuthUser } from "@/server/auth/session";
import { loadRecordAccess, requirePermission } from "@/server/auth/record-access";
import * as controller from "@/server/controllers/hubs_controller";

export const hubsRouter = Router();
hubsRouter.use((_req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });
hubsRouter.use(requireAuthUser, loadRecordAccess);
hubsRouter.get("/options", requirePermission("hubs", "add"), controller.get_hub_option);
hubsRouter.get("/filter-options", requirePermission("hubs", "view"), controller.get_hub_filter_option);
hubsRouter.get("/assignment-options", requirePermission("hubs", "edit"), controller.get_hub_assignment_option);
hubsRouter.get("/assignments", requirePermission("hubs", "edit"), controller.list_hub_assignment);
hubsRouter.get("/assignment-history", requirePermission("hubs", "edit"), controller.list_hub_assignment_history);
hubsRouter.post("/assignments", requirePermission("hubs", "edit"), controller.assign_hub);
hubsRouter.delete("/assignments", requirePermission("hubs", "edit"), controller.unassign_hub);
hubsRouter.get("/", requirePermission("hubs", "view"), (req, res) => {
  if (req.query.id !== undefined) return controller.list_by_id_hub(req, res);
  return controller.list_hub(req, res);
});
hubsRouter.post("/", requirePermission("hubs", "add"), controller.create_hub);
hubsRouter.patch("/", requirePermission("hubs", "edit"), controller.update_hub);
hubsRouter.delete("/", requirePermission("hubs", "delete"), controller.delete_hub);
