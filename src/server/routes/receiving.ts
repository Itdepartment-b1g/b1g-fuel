import { Router } from "express";
import { requireAuthUser } from "@/server/auth/session";
import { loadRecordAccess, requirePermission } from "@/server/auth/record-access";
import {
  create_receiving,
  delete_receiving,
  get_receivable_orders,
  get_receiving_filter_options,
  list_by_id_receiving,
  list_receivings,
  post_receiving,
  update_receiving,
} from "@/server/controllers/receiving_controller";

export const receivingRouter = Router();
receivingRouter.use((_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});
receivingRouter.use(requireAuthUser, loadRecordAccess);
receivingRouter.get("/options", requirePermission("receiving", "view"), get_receivable_orders);
receivingRouter.get("/filter-options", requirePermission("receiving", "view"), get_receiving_filter_options);
receivingRouter.get("/", requirePermission("receiving", "view"), (req, res) => {
  if (req.query.id !== undefined) return list_by_id_receiving(req, res);
  return list_receivings(req, res);
});
receivingRouter.post("/", requirePermission("receiving", "add"), create_receiving);
receivingRouter.post("/post", requirePermission("receiving", "edit"), post_receiving);
receivingRouter.patch("/", requirePermission("receiving", "edit"), update_receiving);
receivingRouter.delete("/", requirePermission("receiving", "delete"), delete_receiving);
