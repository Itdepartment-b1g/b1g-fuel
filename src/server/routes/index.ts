import { Router } from "express";
import { openapi } from "@/lib/openapi/openapi";
import { authRouter } from "./auth";
import { usersRouter } from "./users";
import { rolesRouter } from "./roles";
import { companiesRouter } from "./companies";
import { measurementsRouter } from "./measurements";
import { brandsRouter } from "./brands";
import { variantsRouter } from "./variants";

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
routesRouter.use((_req, res) =>
  res.status(404).json({ error: "Endpoint not found." }),
);
