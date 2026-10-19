import { Router } from "express";
import { openapi } from "@/lib/openapi/openapi";
import { authRouter } from "./auth";
import { usersRouter } from "./users";
import { rolesRouter } from "./roles";
import { companiesRouter } from "./companies";
import { measurementsRouter } from "./measurements";
import { brandsRouter } from "./brands";
import { variantsRouter } from "./variants";
import { suppliersRouter } from "./supplier";
import { productTypesRouter } from "./product_type";
import { productsRouter } from "./product";
import { purchaseOrdersRouter } from "./purchase_order";
import { receivingRouter } from "./receiving";
import { hubsRouter } from "./hubs";
import { companySupplyRouter } from "./company_supply";
import { materialRequestsRouter } from "./material_requests";

export const routesRouter = Router();

routesRouter.get("/api/health", (_req, res) =>
  res.json({ status: "ok", service: "b1g-fuel-api" }),
);
routesRouter.get("/api/openapi", (_req, res) => res.json(openapi));
routesRouter.use("/api/auth", authRouter);
routesRouter.use("/api/users", usersRouter);
routesRouter.use("/api/roles", rolesRouter);
routesRouter.use("/api/companies", companiesRouter);
routesRouter.use("/api/measurements", measurementsRouter);
routesRouter.use("/api/brands", brandsRouter);
routesRouter.use("/api/variants", variantsRouter);
routesRouter.use("/api/suppliers", suppliersRouter);
routesRouter.use("/api/product-types", productTypesRouter);
routesRouter.use("/api/products", productsRouter);
routesRouter.use("/api/purchase-orders", purchaseOrdersRouter);
routesRouter.use("/api/receiving", receivingRouter);
routesRouter.use("/api/hubs", hubsRouter);
routesRouter.use("/api/material-requests", materialRequestsRouter);
routesRouter.use("/api/company-supply-relationships", companySupplyRouter);
routesRouter.use((_req, res) =>
  res.status(404).json({ error: "Endpoint not found." }),
);
