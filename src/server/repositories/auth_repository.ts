import { getPrisma } from "@/server/prisma/client";

export const authRepository = {
  findProfile(userId: string) {
    return getPrisma().user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
  },
  findGlobalRoles(userId: string) {
    return getPrisma().user_role.findMany({
      where: { user_id: userId, scope: "global" },
      select: { role: { select: { slug: true } } },
    });
  },
  upsertFromAuth(id: string, email?: string, name?: string) {
    return getPrisma().user.upsert({
      where: { id },
      create: { id, email, name: name?.trim().slice(0, 250) || email?.slice(0, 250) || "User" },
      update: { email },
    });
  },
};
