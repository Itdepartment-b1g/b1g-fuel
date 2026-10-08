import { getAppOrigin } from "@/server/security/middleware";
import type { RequestHandler } from "express";
import { createAuthClient } from "@/server/auth/supabase";
import { clearAuthSession } from "@/server/auth/clear-session";
import {
  create_google_service,
  type GoogleAuth,
} from "@/server/services/google_auth_service";
import { UserError } from "@/server/utils/errors";
import { respond_auth_error } from "./auth_controller";


type Dependencies = {
  auth_client: (
    req: Parameters<typeof createAuthClient>[0],
    res: Parameters<typeof createAuthClient>[1],
  ) => GoogleAuth;
  get_user_profile?: (
    id: string,
  ) => Promise<{ id: string; name: string; email: string | null } | null>;
};

export function create_google_controller(
  dependencies: Dependencies = {
    auth_client: (req, res) => createAuthClient(req, res).auth,
  },
) {
  const service = create_google_service(dependencies.get_user_profile);
  const start_google_login: RequestHandler = async (req, res) => {
    try {
      res.status(200).json(
        await service.start_google_login(dependencies.auth_client(req, res), getAppOrigin()),
      );
    } catch (error) {
      respond_auth_error(error, res);
    }
  };
  const finish_google_login: RequestHandler = async (req, res) => {
    const origin = getAppOrigin();
    res.set("Referrer-Policy", "no-referrer");
    const redirect_google_error = (code: string) =>
      res.redirect(303, `${origin}/login?auth_error=${code}`);
    if (req.query.error_code === "signup_disabled") {
      redirect_google_error("account_not_provisioned");
      return;
    }
    if (
      req.query.error !== undefined ||
      typeof req.query.code !== "string" ||
      !req.query.code ||
      req.query.code.length > 4096
    ) {
      redirect_google_error("google_failed");
      return;
    }
    let auth: GoogleAuth | undefined;
    try {
      auth = dependencies.auth_client(req, res);
      await service.finish_google_login(auth, req.query.code);
      res.redirect(303, `${origin}/dashboard`);
    } catch (error) {
      if (auth) await clearAuthSession(req, res, auth);
      redirect_google_error(
        error instanceof UserError && error.code === "account_not_provisioned"
          ? "account_not_provisioned"
          : "google_failed",
      );
    }
  };
  return { start_google_login, finish_google_login };
}
const handlers = create_google_controller();
export const start_google_login = handlers.start_google_login;
export const finish_google_login = handlers.finish_google_login;
