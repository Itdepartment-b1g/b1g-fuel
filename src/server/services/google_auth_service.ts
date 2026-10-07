import type { createAuthClient } from "@/server/auth/supabase";
import { authRepository } from "@/server/repositories/auth_repository";
import { UserError } from "@/server/utils/errors";
import { verifyUserToken } from "@/server/security/jwt";
export type GoogleAuth = Pick<
  ReturnType<typeof createAuthClient>["auth"],
  "signInWithOAuth" | "exchangeCodeForSession" | "getUser" | "signOut"
>;
type GetProfile = (
  id: string,
) => Promise<{ id: string; name: string; email: string | null } | null>;

export function createGoogleService(
  getUserProfile: GetProfile = (id) => authRepository.getUserProfile(id),
) {
  return {
    async startGoogleLogin(auth: GoogleAuth, origin: string) {
      try {
        const { data, error } = await auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${origin}/api/auth/google/callback`,
            skipBrowserRedirect: true,
            queryParams: { prompt: "select_account" },
          },
        });
        if (error || !data.url)
          throw new UserError(
            502,
            "Unable to start Google sign-in. Please try again.",
          );
        return { url: data.url };
      } catch {
        throw new UserError(
          502,
          "Unable to start Google sign-in. Please try again.",
        );
      }
    },
    async finishGoogleLogin(auth: GoogleAuth, code: string) {
      const { data, error } = await auth.exchangeCodeForSession(code);
      if (error?.code === "signup_disabled")
        throw new UserError(
          403,
          "Your account has not been provisioned. Contact your administrator.",
        );
      if (error || !data.session)
        throw new UserError(401, "Google sign-in did not complete.");
      const user = await verifyUserToken(auth);
      const profile = await getUserProfile(user.id);
      if (!profile)
        throw new UserError(
          403,
          "Your account has not been provisioned. Contact your administrator.",
        );
      return profile;
    },
  };
}
