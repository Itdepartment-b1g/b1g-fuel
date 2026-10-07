import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { loginUser, logoutUser, getUserSession } from "@/server/controllers/auth_controller";
import { requireAuthUser } from "@/server/auth/session";
import { startGoogleLogin, finishGoogleLogin } from "@/server/controllers/google_auth_controller";

export const authRouter = Router();
authRouter.use((_req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });
authRouter.get("/session", requireAuthUser, getUserSession);
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false, handler: (_req, res) => { res.status(429).json({ error: "Too many attempts. Try again later." }); } });
authRouter.post("/google", authLimiter, startGoogleLogin);
authRouter.get("/google/callback", authLimiter, finishGoogleLogin);
authRouter.post("/login", authLimiter, loginUser);
authRouter.post("/logout", authLimiter, logoutUser);
