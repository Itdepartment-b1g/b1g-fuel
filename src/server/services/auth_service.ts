import type { User } from "@supabase/supabase-js";
import type { createAuthClient } from "@/server/auth/supabase";
import { authRepository } from "@/server/repositories/auth_repository";
import { UserError } from "@/server/utils/errors";
import { verifyUserToken } from "@/server/security/jwt";

type Auth = ReturnType<typeof createAuthClient>["auth"];
type Profile = Awaited<ReturnType<typeof authRepository.getUserProfile>>;
export const authService = {
  async getUserSession(user: User, suppliedProfile?: Profile) {
    const [roles, profile] = await Promise.all([authRepository.listUserGlobalRole(user.id), suppliedProfile ?? authRepository.getUserProfile(user.id)]);
    const name = [user.user_metadata?.full_name, user.user_metadata?.name].find(value => typeof value === "string" && value.trim());
    return { user: { id: user.id, email: user.email ?? null, name: profile?.name ?? name?.trim() ?? null }, global_roles: roles.map(({ role }) => role.slug) };
  },
  async loginUser(auth: Pick<Auth, "signInWithPassword">, input: { email: string; password: string }) {
    const { data, error } = await auth.signInWithPassword(input);
    if (error || !data.user || !data.session) throw new UserError(401, "Invalid email or password.");
    const profile = await authRepository.getUserProfile(data.user.id);
    if (!profile) throw new UserError(403, "Your account has not been provisioned. Contact your administrator.");
    return { user: { id: data.user.id, email: data.user.email ?? null, name: profile.name }, message: "Signed in." };
  },
  async logoutUser(auth: Pick<Auth, "signOut">) {
    const { error } = await auth.signOut();
    if (error) throw new UserError(400, "Unable to sign out.");
    return { message: "Signed out." };
  },
  async requireUserAccess(auth: Pick<Auth, "getUser">) {
    const user = await verifyUserToken(auth);
    const profile = await authRepository.getUserProfile(user.id);
    if (!profile) throw new UserError(403, "Your account has not been provisioned. Contact your administrator.");
    return { user, profile };
  },
  async requireSuperAdmin(userId: string) {
    const roles = await authRepository.listUserGlobalRole(userId);
    if (!roles.some(({ role }) => role.slug === "super_admin")) throw new UserError(403, "Super-admin access is required.");
  },
};
