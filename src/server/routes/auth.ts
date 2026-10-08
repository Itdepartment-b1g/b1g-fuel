import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
  login_user,
  logout_user,
  get_user_session,
} from "@/server/controllers/auth_controller";
import { requireAuthUser } from "@/server/auth/session";
import {
  start_google_login,
  finish_google_login,
} from "@/server/controllers/google_auth_controller";

export const authRouter = Router();
authRouter.use((_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});
authRouter.get("/session", requireAuthUser, get_user_session);
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: "Too many attempts. Try again later." });
  },
});
authRouter.post("/google", authLimiter, start_google_login);
authRouter.get("/google/callback", authLimiter, finish_google_login);
authRouter.post("/login", authLimiter, login_user);
authRouter.post("/logout", authLimiter, logout_user);
