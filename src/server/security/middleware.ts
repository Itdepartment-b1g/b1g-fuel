import type { RequestHandler } from "express";

const allowedMethods = ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"];
const allowedHeaders = ["content-type"];

export function getAppOrigin(): string {
  let url: URL;
  try {
    url = new URL(process.env.APP_ORIGIN ?? "http://localhost:3000");
  } catch {
    throw new Error("Invalid APP_ORIGIN configuration.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("Invalid APP_ORIGIN configuration.");
  return url.origin;
}

/** Exact-origin CORS and mutation-origin protection for cookie-authenticated requests. */
export function createOriginMiddleware(): RequestHandler {
  const expectedOrigin = getAppOrigin();
  return (req, res, next) => {
    const origin = req.get("origin");
    const isMutation = !["GET", "HEAD", "OPTIONS"].includes(req.method);
    res.vary("Origin");
    if (
      (origin !== undefined && origin !== expectedOrigin) ||
      (isMutation && origin !== expectedOrigin)
    ) {
      res.status(403).json({ error: "Request origin is not allowed." });
      return;
    }
    if (origin === expectedOrigin) {
      res.set("Access-Control-Allow-Origin", expectedOrigin);
      res.set("Access-Control-Allow-Credentials", "true");
    }
    if (
      req.method === "OPTIONS" &&
      origin !== undefined &&
      req.get("access-control-request-method")
    ) {
      res.vary("Access-Control-Request-Method");
      res.vary("Access-Control-Request-Headers");
      const method = req.get("access-control-request-method")!;
      const headers = (req.get("access-control-request-headers") ?? "")
        .split(",")
        .map((header) => header.trim().toLowerCase())
        .filter(Boolean);
      if (
        !allowedMethods.includes(method) ||
        headers.some((header) => !allowedHeaders.includes(header))
      ) {
        res
          .status(403)
          .json({ error: "Request method or headers are not allowed." });
        return;
      }
      res.set("Access-Control-Allow-Methods", allowedMethods.join(", "));
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.set("Access-Control-Max-Age", "600");
      res.status(204).end();
      return;
    }
    next();
  };
}
