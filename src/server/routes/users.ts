import { Router } from "express";
import { requireAuthUser } from "@/server/auth/session";
import { requireSuperAdmin } from "@/server/auth/authorization";
import { createUser, createUserLimiter, getUserOption, getUserFilterOption, listUser } from "@/server/controllers/users_controller";

export const usersRouter = Router();
usersRouter.use((_req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });
usersRouter.use(requireAuthUser, requireSuperAdmin);
usersRouter.get("/", listUser);
usersRouter.get("/options", getUserOption);
usersRouter.get("/filter-options", getUserFilterOption);
usersRouter.post("/", createUserLimiter, createUser);
