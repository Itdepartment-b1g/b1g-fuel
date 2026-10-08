import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/server/utils/database";
import { roleTable, userRoleTable, userTable } from "@/server/utils/database_schema";

export const authRepository = {
  async get_user_profile(userId: string) {
    const [user] = await getDatabase().select({ id: userTable.id, name: userTable.name, email: userTable.email })
      .from(userTable).where(eq(userTable.id, userId)).limit(1);
    return user ?? null;
  },
  list_user_global_role(userId: string) {
    return getDatabase().select({ role: { slug: roleTable.slug } }).from(userRoleTable)
      .innerJoin(roleTable, and(eq(roleTable.id, userRoleTable.role_id), eq(roleTable.scope, userRoleTable.scope)))
      .where(and(eq(userRoleTable.user_id, userId), eq(userRoleTable.scope, "global")));
  },
};
