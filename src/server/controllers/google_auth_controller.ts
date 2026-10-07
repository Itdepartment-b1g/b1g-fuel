import type { RequestHandler } from "express";
import { createAuthClient } from "@/server/auth/supabase";
import { clearAuthSession } from "@/server/auth/clear-session";
import { authRepository } from "@/server/repositories/auth_repository";

type OAuthClient = Pick<ReturnType<typeof createAuthClient>["auth"], "signInWithOAuth" | "exchangeCodeForSession" | "getUser" | "signOut">;
type Dependencies = {
  authClient: (req: Parameters<typeof createAuthClient>[0], res: Parameters<typeof createAuthClient>[1]) => OAuthClient;
  findProfile: (id: string) => Promise<{ id: string; name: string; email: string | null } | null>;
};

function appOrigin() {
  const url = new URL(process.env.APP_ORIGIN ?? "http://localhost:3000");
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Invalid APP_ORIGIN configuration.");
  return url.origin;
}

export function createGoogleAuthHandlers(dependencies: Dependencies = {
  authClient: (req, res) => createAuthClient(req, res).auth,
  findProfile: (id) => authRepository.findProfile(id),
}) {
  const start: RequestHandler = async (req, res) => {
    const origin = appOrigin();
    try {
      const { data, error } = await dependencies.authClient(req, res).signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${origin}/api/auth/google/callback`, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
      });
      if (error || !data.url) { res.status(502).json({ error: "Unable to start Google sign-in. Please try again." }); return; }
      res.json({ url: data.url });
    } catch { res.status(502).json({ error: "Unable to start Google sign-in. Please try again." }); }
  };

  const callback: RequestHandler = async (req, res) => {
    const origin = appOrigin();
    res.set("Referrer-Policy", "no-referrer");
    const failure = (code: string) => res.redirect(303, `${origin}/login?auth_error=${code}`);
    if (req.query.error_code === "signup_disabled") { failure("account_not_provisioned"); return; }
    if (req.query.error !== undefined || typeof req.query.code !== "string" || !req.query.code || req.query.code.length > 4096) {
      failure("google_failed"); return;
    }
    let auth: OAuthClient | undefined;
    try {
      auth = dependencies.authClient(req, res);
      const { data, error } = await auth.exchangeCodeForSession(req.query.code);
      if (error || !data.session) {
        await clearAuthSession(req, res, auth);
        failure(error?.code === "signup_disabled" ? "account_not_provisioned" : "google_failed"); return;
      }
      const { data: verified, error: verifyError } = await auth.getUser();
      if (verifyError || !verified.user) {
        await clearAuthSession(req, res, auth); failure("google_failed"); return;
      }
      const profile = await dependencies.findProfile(verified.user.id);
      if (!profile) {
        await clearAuthSession(req, res, auth); failure("account_not_provisioned"); return;
      }
      res.redirect(303, `${origin}/dashboard`);
    } catch {
      if (auth) await clearAuthSession(req, res, auth);
      failure("google_failed");
    }
  };
  return { start, callback };
}

const handlers = createGoogleAuthHandlers();
export const startGoogleLogin = handlers.start;
export const finishGoogleLogin = handlers.callback;
