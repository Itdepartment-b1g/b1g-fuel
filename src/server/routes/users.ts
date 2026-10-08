import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import { requireAuthUser } from "@/server/auth/session";
import { requireSuperAdmin } from "@/server/auth/authorization";
import { create_user, get_user_option, get_user_filter_option, list_user } from "@/server/controllers/users_controller";

const create_user_limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) => {
    res
      .status(429)
      .json({ error: "Too many user creation attempts. Try again later." });
  },
});

export const usersRouter = Router();
usersRouter.use((_req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });
usersRouter.use(requireAuthUser, requireSuperAdmin);
usersRouter.get("/", list_user);
usersRouter.get("/options", get_user_option);
usersRouter.get("/filter-options", get_user_filter_option);
usersRouter.post("/", create_user_limiter, create_user);
