import { Router } from "express";
import { requireAuthUser } from "@/server/auth/session";
import { requireSuperAdmin } from "@/server/auth/authorization";
import { loadRecordAccess } from "@/server/auth/record-access";
import * as controller from "@/server/controllers/company_supply_controller";

export const companySupplyRouter = Router();
companySupplyRouter.use((_req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });
companySupplyRouter.use(requireAuthUser, requireSuperAdmin, loadRecordAccess);
companySupplyRouter.get("/options", controller.get_company_supply_option);
companySupplyRouter.get("/", controller.list_company_supply);
companySupplyRouter.post("/", controller.create_company_supply);
companySupplyRouter.patch("/", controller.update_company_supply);
