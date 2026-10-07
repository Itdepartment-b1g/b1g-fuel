import { createAuthClient } from "@/server/auth/supabase";
import { clearAuthSession } from "@/server/auth/clear-session";
import { authService } from "@/server/services/auth_service";
import { UserError } from "@/server/utils/errors";
import { handleController } from "./error_handler";

export const getUserSession = handleController(async (_req, res) => { res.json(await authService.getUserSession(res.locals.user, res.locals.profile)); });
export const loginUser = handleController(async (req, res) => {
  const input = validateLoginUser(req.body);
  const auth = createAuthClient(req, res).auth;
  try { res.json(await authService.loginUser(auth, input)); }
  catch (error) { if (!(error instanceof UserError && error.status === 401)) await clearAuthSession(req, res, auth); throw error; }
});
export const logoutUser = handleController(async (req, res) => { res.json(await authService.logoutUser(createAuthClient(req, res).auth)); });

export function validateLoginUser(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new UserError(400, "Provide a valid email and a password of at least 8 characters.");
  const { email, password } = body as Record<string, unknown>;
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || typeof password !== "string" || password.length < 8) throw new UserError(400, "Provide a valid email and a password of at least 8 characters.");
  return { email: email.trim(), password };
}
