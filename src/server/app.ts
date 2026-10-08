import express, { type ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { routesRouter } from "@/server/routes";
import { PaginationError } from "@/server/utils/pagination";
import { createOriginMiddleware } from "@/server/security/middleware";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(createOriginMiddleware());
  app.use(express.json({ limit: "16kb" }));
  app.use(cookieParser());
  app.use(routesRouter);
  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof PaginationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error?.type === "entity.parse.failed") {
      res.status(400).json({ error: "Request body must be valid JSON." });
      return;
    }
    if (error?.type === "entity.too.large") {
      res.status(413).json({ error: "Request body is too large." });
      return;
    }
    console.error("API request failed:", error);
    res.status(500).json({ error: "The request could not be completed." });
  };
  app.use(handleError);
  return app;
}
