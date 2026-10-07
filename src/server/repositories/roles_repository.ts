import { getPrisma } from "@/server/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import type { CreateRoleInput, UpdateRoleInput, RoleSummary, RoleScope } from "@/lib/roles";
import { paginationMetadata, type Pagination } from "@/server/utils/pagination";

const roleSelect = {
  id: true, name: true, slug: true, scope: true, is_system: true, is_default_role: true,
  created_at: true, updated_at: true,
  pages: { select: { page_key: true }, orderBy: { page_key: "asc" } },
  permissions: { select: { permission_key: true }, orderBy: { permission_key: "asc" } },
  _count: { select: { user_roles: true, company_roles: true } },
} as const;
type RoleRecord = Prisma.rolesGetPayload<{ select: typeof roleSelect }>;
type ExpectedRole = Pick<RoleSummary, "is_system" | "slug" | "scope">;
function serializeRole(role: RoleRecord): RoleSummary {
  return {
    id: role.id, name: role.name, slug: role.slug, scope: role.scope,
    is_system: role.is_system, is_default_role: role.is_default_role,
    created_at: role.created_at.toISOString(), updated_at: role.updated_at.toISOString(),
    pages: role.pages.map(page => page.page_key), permissions: role.permissions.map(permission => permission.permission_key),
    assignment_count: role._count.user_roles + role._count.company_roles,
  };
}
function createRoleRepository(client: Prisma.TransactionClient) {
  return {
    async getRole(id: string) {
      const role = await client.roles.findUnique({ where: { id }, select: roleSelect });
      return role ? serializeRole(role) : null;
    },
    async createRole(input: Required<CreateRoleInput>) {
      const role = await client.roles.create({ data: {
        name: input.name, slug: input.slug, scope: input.scope, is_system: false, is_default_role: input.is_default_role,
        pages: { create: input.pages.map(page_key => ({ page_key })) }, permissions: { create: input.permissions.map(permission_key => ({ permission_key })) },
      }, select: roleSelect });
      return serializeRole(role);
    },
    async updateRole(input: UpdateRoleInput, expected: ExpectedRole) {
      const result = await client.roles.updateMany({ where: { id: input.id, ...expected }, data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.is_default_role !== undefined ? { is_default_role: input.is_default_role } : {}), updated_at: new Date(),
      } });
      if (!result.count) return null;
      if (input.pages !== undefined) {
        await client.role_pages.deleteMany({ where: { role_id: input.id } });
        if (input.pages.length) await client.role_pages.createMany({ data: input.pages.map(page_key => ({ role_id: input.id, page_key })) });
      }
      if (input.permissions !== undefined) {
        await client.role_permissions.deleteMany({ where: { role_id: input.id } });
        if (input.permissions.length) await client.role_permissions.createMany({ data: input.permissions.map(permission_key => ({ role_id: input.id, permission_key })) });
      }
      const role = await client.roles.findUnique({ where: { id: input.id }, select: roleSelect });
      return role ? serializeRole(role) : null;
    },
    async deleteRole(id: string, expected: ExpectedRole) {
      const result = await client.roles.deleteMany({ where: { id, ...expected } });
      return Boolean(result.count);
    },
  };
}
export type RoleTransactionRepository = ReturnType<typeof createRoleRepository>;
export const rolesRepository = {
  async listRole(pagination: Pagination, search: string, scope?: RoleScope) {
    const where: Prisma.rolesWhereInput = { ...(scope ? { scope } : {}), ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { slug: { contains: search, mode: "insensitive" } }] } : {}) };
    const prisma = getPrisma();
    const [roles, total] = await prisma.$transaction([
      prisma.roles.findMany({ where, select: roleSelect, orderBy: [{ created_at: "desc" }, { id: "asc" }], skip: pagination.skip, take: pagination.take }),
      prisma.roles.count({ where }),
    ], { isolationLevel: "RepeatableRead" });
    return { roles: roles.map(serializeRole), ...paginationMetadata(total, pagination) };
  },
  getRole(id: string) { return createRoleRepository(getPrisma()).getRole(id); },
  createRole(input: Required<CreateRoleInput>) { return createRoleRepository(getPrisma()).createRole(input); },
  runRoleTransaction<T>(operation: (repository: RoleTransactionRepository) => Promise<T>) {
    return getPrisma().$transaction(tx => operation(createRoleRepository(tx)));
  },
};
