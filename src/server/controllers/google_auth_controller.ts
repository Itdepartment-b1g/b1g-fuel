import { getAppOrigin } from "@/server/security/middleware";
import type { RequestHandler } from "express";
import { createAuthClient } from "@/server/auth/supabase";
import { clearAuthSession } from "@/server/auth/clear-session";
import {
  createGoogleService,
  type GoogleAuth,
} from "@/server/services/google_auth_service";
import { UserError, handleController } from "@/server/utils/errors";


type Dependencies = {
  authClient: (
    req: Parameters<typeof createAuthClient>[0],
    res: Parameters<typeof createAuthClient>[1],
  ) => GoogleAuth;
  getUserProfile?: (
    id: string,
  ) => Promise<{ id: string; name: string; email: string | null } | null>;
};

export function createGoogleController(
  dependencies: Dependencies = {
    authClient: (req, res) => createAuthClient(req, res).auth,
  },
) {
  const service = createGoogleService(dependencies.getUserProfile);
  const startGoogleLogin = handleController(async (req, res) => {
    res.json(
      await service.startGoogleLogin(
        dependencies.authClient(req, res),
        getAppOrigin(),
      ),
    );
  });
  const finishGoogleLogin: RequestHandler = async (req, res) => {
    const origin = getAppOrigin();
    res.set("Referrer-Policy", "no-referrer");
    const redirectGoogleError = (code: string) =>
      res.redirect(303, `${origin}/login?auth_error=${code}`);
    if (req.query.error_code === "signup_disabled") {
      redirectGoogleError("account_not_provisioned");
      return;
    }
    if (
      req.query.error !== undefined ||
      typeof req.query.code !== "string" ||
      !req.query.code ||
      req.query.code.length > 4096
    ) {
      redirectGoogleError("google_failed");
      return;
    }
    let auth: GoogleAuth | undefined;
    try {
      auth = dependencies.authClient(req, res);
      await service.finishGoogleLogin(auth, req.query.code);
      res.redirect(303, `${origin}/dashboard`);
    } catch (error) {
      if (auth) await clearAuthSession(req, res, auth);
      redirectGoogleError(
        error instanceof UserError && error.status === 403
          ? "account_not_provisioned"
          : "google_failed",
      );
    }
  };
  return { startGoogleLogin, finishGoogleLogin };
}
const handlers = createGoogleController();
export const startGoogleLogin = handlers.startGoogleLogin;
export const finishGoogleLogin = handlers.finishGoogleLogin;
