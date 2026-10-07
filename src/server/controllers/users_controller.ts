import type { RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { usersRepository } from "@/server/repositories/users_repository";
import { createUsersService, parseCreateUser, UsersError } from "@/server/services/users_service";
import { parsePagination, PaginationError } from "@/server/utils/pagination";

const service = createUsersService();

export const createUserLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: "Too many user creation attempts. Try again later." });
  },
});

function handler(action: RequestHandler): RequestHandler {
  return async (req, res, next) => {
    try { await action(req, res, next); }
    catch (error) {
      if (error instanceof UsersError || error instanceof PaginationError) { res.status(error.status).json({ error: error.message }); return; }
      next(error);
    }
  };
}
export const listUsers = handler(async (req, res) => {
  const pagination = parsePagination(req.query);
  const search = req.query.search ?? "";
  if (typeof search !== "string" || search.length > 254) throw new UsersError(400, "Invalid search value.");
  res.json(await usersRepository.list(pagination, search.trim()));
});
export const getUserOptions = handler(async (_req, res) => { res.json(await usersRepository.options()); });
export const createUser = handler(async (req, res) => { res.status(201).json({ user: await service.create(parseCreateUser(req.body)) }); });
