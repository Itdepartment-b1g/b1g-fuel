import type { User } from "@supabase/supabase-js";
import type { createAuthClient } from "@/server/auth/supabase";
import { UserError } from "@/server/services/users_service";

type TokenVerifier = Pick<ReturnType<typeof createAuthClient>["auth"], "getUser">;

/** Verify the cookie-session access token, or an explicitly supplied Supabase JWT. */
export async function verifyUserToken(auth: TokenVerifier, token?: string): Promise<User> {
  if (token !== undefined && (typeof token !== "string" || token.length > 16384 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))) {
    throw new UserError("invalid_session", "Sign in to continue.");
  }
  // Supabase verifies signature/expiry and returns the authenticated identity.
  // Never authorize using an unverified decoded payload or getSession() alone.
  const { data: { user }, error } = token === undefined ? await auth.getUser() : await auth.getUser(token);
  if (error || !user) throw new UserError("invalid_session", "Sign in to continue.");
  return user;
}
