import { getDatabase, type Database } from "@/server/lib/database";

export const authRepository = {
  /** Find the reserved super_admin role by slug and return its ID and scope. Return null when the role has not been created. */
  get_super_admin_role() {
    return getDatabase().roles.findUnique({
      where: { slug: "super_admin" },
      select: { id: true, scope: true },
    });
  },
  /** Create or normalize the global super_admin role, upsert the user profile and ensure its global assignment in one transaction. Return false if the existing role has an incompatible scope or the guarded role update no longer matches. */
  async seed_super_admin(
    database: Database,
    authId: string,
    fullName: string,
    email: string,
  ) {
    return database.$transaction(async (tx) => {
      let role = await tx.roles.findUnique({
        where: { slug: "super_admin" },
        select: { id: true, scope: true },
      });
      if (role) {
        if (role.scope !== "global") return false;
        const changed = await tx.roles.updateMany({
          where: { id: role.id, scope: "global" },
          data: { is_system: true, is_default_role: false },
        });
        if (!changed.count) return false;
      } else {
        role = await tx.roles.create({
          data: {
            name: "Super Admin",
            slug: "super_admin",
            scope: "global",
            is_system: true,
          },
          select: { id: true, scope: true },
        });
      }
      await tx.user.upsert({
        where: { id: authId },
        create: { id: authId, name: fullName, email },
        update: { name: fullName, email },
      });
      await tx.user_role.upsert({
        where: { user_id_role_id: { user_id: authId, role_id: role.id } },
        create: { user_id: authId, role_id: role.id, scope: "global" },
        update: {},
      });
      return true;
    });
  },
  /** Find the database profile for an Auth user ID and return its ID, name and email. Return null when the account has no provisioned profile. */
  get_user_profile(userId: string) {
    return getDatabase().user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });
  },
  /** Load the slugs of roles assigned directly to a user with global scope. Authorization uses these assignments to determine global access. */
  list_user_global_role(userId: string) {
    return getDatabase().user_role.findMany({
      where: { user_id: userId, scope: "global" },
      select: { role: { select: { slug: true } } },
    });
  },
};
