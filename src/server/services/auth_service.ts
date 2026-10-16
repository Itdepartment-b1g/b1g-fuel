import type { User } from "@supabase/supabase-js";
import type { createAuthClient } from "@/server/auth/supabase";
import { authRepository } from "@/server/repositories/auth_repository";
import { UserError } from "@/server/services/users_service";
import { verifyUserToken } from "@/server/security/jwt";
import { get_record_access } from "@/server/auth/record-access";

type Auth = ReturnType<typeof createAuthClient>["auth"];
type Profile = Awaited<ReturnType<typeof authRepository.get_user_profile>>;
export const authService = {
  async get_user_session(user: User, suppliedProfile?: Profile) {
    const [roles, profile, roleNames] = await Promise.all([
      authRepository.list_user_global_role(user.id),
      suppliedProfile ?? authRepository.get_user_profile(user.id),
      authRepository.list_user_role_names(user.id),
    ]);
    const name = [user.user_metadata?.full_name, user.user_metadata?.name].find(value => typeof value === "string" && value.trim());
    const access = await get_record_access(user.id);
    return { user: { id: user.id, email: user.email ?? null, name: profile?.name ?? name?.trim() ?? null }, global_roles: roles.map(({ role }) => role.slug), roles: roleNames, access };
  },
  async login_user(auth: Pick<Auth, "signInWithPassword">, input: { email: string; password: string }) {
    const { data, error } = await auth.signInWithPassword(input);
    if (error || !data.user || !data.session) throw new UserError("invalid_credentials", "Invalid email or password.");
    const profile = await authRepository.get_user_profile(data.user.id);
    if (!profile) throw new UserError("account_not_provisioned", "Your account has not been provisioned. Contact your administrator.");
    return { user: { id: data.user.id, email: data.user.email ?? null, name: profile.name }, message: "Signed in." };
  },
  async logout_user(auth: Pick<Auth, "signOut">) {
    const { error } = await auth.signOut();
    if (error) throw new UserError("logout_failed", "Unable to sign out.");
    return { message: "Signed out." };
  },
  async require_user_access(auth: Pick<Auth, "getUser">) {
    const user = await verifyUserToken(auth);
    const profile = await authRepository.get_user_profile(user.id);
    if (!profile) throw new UserError("account_not_provisioned", "Your account has not been provisioned. Contact your administrator.");
    return { user, profile };
  },
  async require_super_admin(userId: string) {
    const roles = await authRepository.list_user_global_role(userId);
    if (!roles.some(({ role }) => role.slug === "super_admin")) throw new UserError("super_admin_required", "Super-admin access is required.");
  },
};
