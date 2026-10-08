import type { RequestHandler, Response } from "express";
import { createAuthClient } from "@/server/auth/supabase";
import { clearAuthSession } from "@/server/auth/clear-session";
import { authService } from "@/server/services/auth_service";
import { UserError, type ApplicationErrorCode } from "@/server/utils/errors";

const authErrorStatus: Partial<Record<ApplicationErrorCode, number>> = {
  invalid_input: 400,
  invalid_session: 401,
  invalid_credentials: 401,
  account_not_provisioned: 403,
  super_admin_required: 403,
  logout_failed: 400,
  google_start_failed: 502,
  google_exchange_failed: 401,
};

// Authentication guards and Google handlers share the controller's HTTP translation.
export function respond_auth_error(error: unknown, res: Response) {
  if (error instanceof UserError && authErrorStatus[error.code]) {
    res.status(authErrorStatus[error.code]!).json({ error: error.message });
    return;
  }
  console.error("Authentication request failed:", error);
  res.status(500).json({ error: "The request could not be completed." });
}

export const get_user_session: RequestHandler = async (_req, res) => {
  try {
    res.status(200).json(await authService.get_user_session(res.locals.user, res.locals.profile));
  } catch (error) {
    respond_auth_error(error, res);
  }
};
export const login_user: RequestHandler = async (req, res) => {
  let auth: ReturnType<typeof createAuthClient>["auth"] | undefined;
  try {
    const input = validate_login_user(req.body);
    auth = createAuthClient(req, res).auth;
    res.status(200).json(await authService.login_user(auth, input));
  } catch (error) {
    if (auth && !(error instanceof UserError && error.code === "invalid_credentials"))
      await clearAuthSession(req, res, auth);
    respond_auth_error(error, res);
  }
};
export const logout_user: RequestHandler = async (req, res) => {
  try {
    res.status(200).json(await authService.logout_user(createAuthClient(req, res).auth));
  } catch (error) {
    respond_auth_error(error, res);
  }
};

export function validate_login_user(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new UserError("invalid_input", "Provide a valid email and a password of at least 8 characters.");
  const { email, password } = body as Record<string, unknown>;
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || typeof password !== "string" || password.length < 8) throw new UserError("invalid_input", "Provide a valid email and a password of at least 8 characters.");
  return { email: email.trim(), password };
}
