import type { Request, Response } from "express";
import type { createAuthClient } from "./supabase";

type SessionAuth = Pick<ReturnType<typeof createAuthClient>["auth"], "signOut">;

/** Revoke only this browser session and clear project auth cookies even if revocation fails. */
export async function clearAuthSession(req: Request, res: Response, auth: SessionAuth) {
  try { await auth.signOut({ scope: "local" }); }
  catch { /* Local cookies must still be cleared when Auth is unavailable. */ }
  finally {
    for (const name of Object.keys(req.cookies ?? {})) {
      if (/^sb-.+-auth-token(?:\.\d+|-code-verifier)?$/.test(name)) {
        res.clearCookie(name, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
      }
    }
  }
}
