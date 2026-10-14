import { Router } from "express";
import { requireAuthUser } from "@/server/auth/session";
import { loadRecordAccess, requirePermission } from "@/server/auth/record-access";
import {
  create_brand,
  delete_brand,
  get_brand_filter_options,
  get_brand_options,
  list_brands,
  update_brand,
} from "@/server/controllers/brands_controller";

export const brandsRouter = Router();
brandsRouter.use((_req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });
brandsRouter.use(requireAuthUser, loadRecordAccess);
brandsRouter.get("/options", requirePermission("brandsAndVariants", "add"), get_brand_options);
brandsRouter.get("/filter-options", requirePermission("brandsAndVariants", "view"), get_brand_filter_options);
brandsRouter.get("/", requirePermission("brandsAndVariants", "view"), list_brands);
brandsRouter.post("/", requirePermission("brandsAndVariants", "add"), create_brand);
brandsRouter.patch("/", requirePermission("brandsAndVariants", "edit"), update_brand);
brandsRouter.delete("/", requirePermission("brandsAndVariants", "delete"), delete_brand);
