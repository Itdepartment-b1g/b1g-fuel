import type { RequestHandler } from "express";
import { ApplicationError } from "@/server/utils/errors";
import { PaginationError } from "@/server/utils/pagination";

export function handleController(
  action: RequestHandler,
  databaseErrors: Record<string, { status: number; message: string }> = {},
): RequestHandler {
  return async (req, res, next) => {
    try {
      await action(req, res, next);
    } catch (error) {
      if (
        error instanceof ApplicationError ||
        error instanceof PaginationError
      ) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      const code =
        error &&
        typeof error === "object" &&
        "code" in error &&
        typeof error.code === "string"
          ? error.code
          : "";
      const mapped = databaseErrors[code];
      if (mapped) {
        res.status(mapped.status).json({ error: mapped.message });
        return;
      }
      next(error);
    }
  };
}
