import express, { type ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { authRouter } from "@/server/routes/auth";
import { openapi } from "@/lib/openapi";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "16kb" }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const expected = process.env.APP_ORIGIN ?? "http://localhost:3000";
      if (req.get("origin") !== expected) { res.status(403).json({ error: "Request origin is not allowed." }); return; }
    }
    next();
  });
  app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "b1g-fuel-api" }));
  app.get("/api/openapi", (_req, res) => res.json(openapi));
  app.use("/api/auth", authRouter);
  app.use((_req, res) => res.status(404).json({ error: "Endpoint not found." }));
  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error?.type === "entity.parse.failed") { res.status(400).json({ error: "Request body must be valid JSON." }); return; }
    if (error?.type === "entity.too.large") { res.status(413).json({ error: "Request body is too large." }); return; }
    console.error("API request failed:", error);
    res.status(500).json({ error: "The request could not be completed." });
  };
  app.use(handleError);
  return app;
}
