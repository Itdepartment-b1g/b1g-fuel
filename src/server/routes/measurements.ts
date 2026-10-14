import { Router } from "express";
import { requireAuthUser } from "@/server/auth/session";
import { loadRecordAccess, requirePermission } from "@/server/auth/record-access";
import { archive_measurement, create_measurement, list_measurements, update_measurement } from "@/server/controllers/measurements_controller";

export const measurementsRouter = Router();
measurementsRouter.use((_req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });
measurementsRouter.use(requireAuthUser, loadRecordAccess);
measurementsRouter.get("/", requirePermission("measurements", "view"), list_measurements);
measurementsRouter.post("/", requirePermission("measurements", "add"), create_measurement);
measurementsRouter.patch("/", requirePermission("measurements", "edit"), update_measurement);
measurementsRouter.delete("/", requirePermission("measurements", "delete"), archive_measurement);
