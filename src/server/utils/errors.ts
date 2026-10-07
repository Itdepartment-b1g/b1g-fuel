import type { RequestHandler } from "express";
import { PaginationError } from "./pagination";

/** Safe application errors are raised by business rules and translated by controllers. */
export class ApplicationError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export class UserError extends ApplicationError {}
export class RoleError extends ApplicationError {}

export function handleController(
  action: RequestHandler,
  databaseErrors: Record<string, { status: number; message: string }> = {},
): RequestHandler {
  return async (req, res, next) => {
    try {
      await action(req, res, next);
    } catch (error) {
      if (error instanceof ApplicationError || error instanceof PaginationError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "";
      const mapped = databaseErrors[code];
      if (mapped) {
        res.status(mapped.status).json({ error: mapped.message });
        return;
      }
      next(error);
    }
  };
}
