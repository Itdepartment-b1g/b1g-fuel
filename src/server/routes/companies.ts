import { Router } from "express";
import { requireAuthUser } from "@/server/auth/session";
import { requireSuperAdmin } from "@/server/auth/authorization";
import { create_company, delete_company, edit_company, list_company, update_company } from "@/server/controllers/companies_controller";

export const companiesRouter = Router();
companiesRouter.use((_req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });
companiesRouter.use(requireAuthUser, requireSuperAdmin);
companiesRouter.get("/", (req, res, next) => (req.query.id === undefined ? list_company : edit_company)(req, res, next));
companiesRouter.post("/", create_company);
companiesRouter.patch("/", update_company);
companiesRouter.delete("/", delete_company);
