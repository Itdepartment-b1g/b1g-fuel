import { loadRecordAccess, requirePermission } from "@/server/auth/record-access";
import { Router } from "express";
import { requireAuthUser } from "@/server/auth/session";
import {
  create_company,
  delete_company,
  list_by_id_company,
  list_company,
  update_company,
} from "@/server/controllers/companies_controller";

export const companiesRouter = Router();
companiesRouter.use((_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});
companiesRouter.use(requireAuthUser, loadRecordAccess);
companiesRouter.get("/", requirePermission("companies", "view"), (req, res, next) =>
  (req.query.id === undefined ? list_company : list_by_id_company)(req, res, next),
);
companiesRouter.post("/", requirePermission("companies", "add"), create_company);
companiesRouter.patch("/", requirePermission("companies", "edit"), update_company);
companiesRouter.delete("/", requirePermission("companies", "delete"), delete_company);
