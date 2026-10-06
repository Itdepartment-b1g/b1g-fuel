import { getPrisma } from "@/server/prisma/client";

export const authRepository = {
  findGlobalRoles(userId: string) {
    return getPrisma().user_role.findMany({
      where: { user_id: userId, scope: "global" },
      select: { role: { select: { slug: true } } },
    });
  },
  upsertFromAuth(id: string, email?: string) {
    return getPrisma().user.upsert({
      where: { id },
      create: { id, email },
      update: { email },
    });
  },
};
