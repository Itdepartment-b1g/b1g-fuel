import type { createAuthClient } from "@/server/auth/supabase";
import { authRepository } from "@/server/repositories/auth_repository";
import { UserError } from "@/server/services/users_service";
import { verifyUserToken } from "@/server/security/jwt";
export type GoogleAuth = Pick<
  ReturnType<typeof createAuthClient>["auth"],
  "signInWithOAuth" | "exchangeCodeForSession" | "getUser" | "signOut"
>;
type GetProfile = (
  id: string,
) => Promise<{ id: string; name: string; email: string | null } | null>;

export function create_google_service(
  get_user_profile: GetProfile = (id) => authRepository.get_user_profile(id),
) {
  return {
    async start_google_login(auth: GoogleAuth, origin: string) {
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
          throw new UserError("google_start_failed", "Unable to start Google sign-in. Please try again.",
          );
        return { url: data.url };
      } catch {
        throw new UserError("google_start_failed", "Unable to start Google sign-in. Please try again.",
        );
      }
    },
    async finish_google_login(auth: GoogleAuth, code: string) {
      const { data, error } = await auth.exchangeCodeForSession(code);
      if (error?.code === "signup_disabled")
        throw new UserError("account_not_provisioned", "Your account has not been provisioned. Contact your administrator.",
        );
      if (error || !data.session)
        throw new UserError("google_exchange_failed", "Google sign-in did not complete.");
      const user = await verifyUserToken(auth);
      const profile = await get_user_profile(user.id);
      if (!profile)
        throw new UserError("account_not_provisioned", "Your account has not been provisioned. Contact your administrator.",
        );
      return profile;
    },
  };
}
