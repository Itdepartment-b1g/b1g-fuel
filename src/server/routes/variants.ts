import { Router } from "express";
import { requireAuthUser } from "@/server/auth/session";
import { loadRecordAccess, requirePermission } from "@/server/auth/record-access";
import {
  create_variant,
  delete_variant,
  get_variant_options,
  list_variants,
  update_variant,
} from "@/server/controllers/variants_controller";

export const variantsRouter = Router();
variantsRouter.use((_req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });
variantsRouter.use(requireAuthUser, loadRecordAccess);
variantsRouter.get("/options", requirePermission("brandsAndVariants", "add"), get_variant_options);
variantsRouter.get("/", requirePermission("brandsAndVariants", "view"), list_variants);
variantsRouter.post("/", requirePermission("brandsAndVariants", "add"), create_variant);
variantsRouter.patch("/", requirePermission("brandsAndVariants", "edit"), update_variant);
variantsRouter.delete("/", requirePermission("brandsAndVariants", "delete"), delete_variant);
