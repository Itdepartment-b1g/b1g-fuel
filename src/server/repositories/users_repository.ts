import { getPrisma } from "@/server/prisma/client";
import type { CreateUserInput, UserSummary } from "@/lib/users";
import { paginationMetadata, type Pagination } from "@/server/utils/pagination";

const roleSelect = { id: true, name: true, slug: true } as const;
const userSelect = {
  id: true, name: true, email: true, created_at: true,
  user_roles: { select: { role: { select: roleSelect } } },
  user_companies: { select: {
    company: { select: { id: true, name: true } },
    roles: { select: { role: { select: roleSelect } } },
  } },
} as const;

function summarize(user: {
  id: string; name: string; email: string | null; created_at: Date;
  user_roles: { role: UserSummary["global_roles"][number] }[];
  user_companies: { company: { id: string; name: string }; roles: { role: UserSummary["global_roles"][number] }[] }[];
}): UserSummary {
  return {
    id: user.id, name: user.name, email: user.email, created_at: user.created_at.toISOString(),
    global_roles: user.user_roles.map(({ role }) => role),
    companies: user.user_companies.map(({ company, roles }) => ({ ...company, roles: roles.map(({ role }) => role) })),
  };
}

export const usersRepository = {
  async list(pagination: Pagination, search: string) {
    const where = search ? { OR: [
      { name: { contains: search, mode: "insensitive" as const } },
      { email: { contains: search, mode: "insensitive" as const } },
    ] } : {};
    const [users, total] = await getPrisma().$transaction([
      getPrisma().user.findMany({ where, select: userSelect, orderBy: [{ created_at: "desc" }, { id: "asc" }], skip: pagination.skip, take: pagination.take }),
      getPrisma().user.count({ where }),
    ], { isolationLevel: "RepeatableRead" });
    return { users: users.map(summarize), ...paginationMetadata(total, pagination) };
  },
  async options() {
    const [companies, roles] = await Promise.all([
      getPrisma().company.findMany({ select: { id: true, name: true }, orderBy: [{ name: "asc" }, { id: "asc" }] }),
      getPrisma().roles.findMany({ where: { scope: "company" }, select: roleSelect, orderBy: { name: "asc" } }),
    ]);
    return { companies, roles };
  },
  async validateAssignments(input: CreateUserInput) {
    const roleIds = input.role_ids ?? [];
    const [existing, company, roles] = await Promise.all([
      getPrisma().user.findFirst({ where: { email: { equals: input.email, mode: "insensitive" } }, select: { id: true } }),
      input.company_id === undefined ? null : getPrisma().company.findUnique({ where: { id: input.company_id }, select: { id: true } }),
      roleIds.length ? getPrisma().roles.count({ where: { id: { in: roleIds }, scope: "company" } }) : 0,
    ]);
    return { duplicate: Boolean(existing), valid: input.company_id === undefined ? roleIds.length === 0 : Boolean(company) && roles === roleIds.length };
  },
  async create(id: string, input: CreateUserInput) {
    return getPrisma().$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { id, name: input.name, email: input.email, ...(input.company_id === undefined ? {} : { user_companies: { create: {
          company_id: input.company_id,
          roles: { create: (input.role_ids ?? []).map((role_id) => ({ role_id, scope: "company" as const })) },
        } } }) }, select: userSelect,
      });
      return summarize(user);
    });
  },
};
