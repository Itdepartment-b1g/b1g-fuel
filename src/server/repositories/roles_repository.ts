import type { Prisma } from "@/generated/prisma/client";
import { getDatabase, type DatabaseExecutor } from "@/server/utils/database";
import type {
  CreateRoleInput,
  UpdateRoleInput,
  RoleSummary,
  RoleScope,
} from "@/server/schema/roles_schema";
import { paginationMetadata, type Pagination } from "@/server/utils/pagination";

const role_include = {
  pages: { select: { page_key: true }, orderBy: { page_key: "asc" } },
  permissions: {
    select: { 
      permission_key: true
     },
    orderBy: {
       permission_key: "asc"
       },
  },
  _count: { select: { user_roles: true, company_roles: true } },
} satisfies Prisma.rolesInclude;

type RoleRecord = Prisma.rolesGetPayload<{
   include: typeof role_include 
  }>;
type ExpectedRole = Pick<RoleSummary, "is_system" | "slug" | "scope">;

function serialize_role(role: RoleRecord): RoleSummary {
  const { pages, permissions, _count, ...record } = role;
  return {
    ...record,
    created_at: record.created_at.toISOString(),
    updated_at: record.updated_at.toISOString(),
    pages: pages.map((page) => page.page_key),
    permissions: permissions.map((permission) => permission.permission_key),
    assignment_count: _count.user_roles + _count.company_roles,
  };
}

export async function list_role(
  pagination: Pagination,
  search: string,
  scope?: RoleScope,
) {
  const where: Prisma.rolesWhereInput = {
    ...(scope ? { scope } : {}),
    ...(search
      ? {
          OR: [
            { name: literal_contains(search) },
            { slug: literal_contains(search) },
          ],
        }
      : {}),
  };
  return getDatabase().$transaction(
    async (tx) => {
      const roles = await tx.roles.findMany({
        where,
        include: role_include,
        orderBy: [{ created_at: "desc" }, { id: "asc" }],
        skip: pagination.skip,
        take: pagination.take,
      });
      const total = await tx.roles.count({ where });
      return {
        roles: roles.map(serialize_role),
        ...paginationMetadata(total, pagination),
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}

export async function list_by_id_role(
  id: string,
  client: DatabaseExecutor = getDatabase(),
) {
  const role = await client.roles.findUnique({
    where: { id },
    include: role_include,
  });
  return role ? serialize_role(role) : null;
}

export async function create_role(input: Required<CreateRoleInput>) {
  return getDatabase().$transaction(async (tx) => {
    const role = await tx.roles.create({
      data: {
        name: input.name,
        slug: input.slug,
        scope: input.scope,
        is_system: false,
        is_default_role: input.is_default_role,
        pages: { create: input.pages.map((page_key) => ({ page_key })) },
        permissions: {
          create: input.permissions.map((permission_key) => ({
            permission_key,
          })),
        },
      },
      include: role_include,
    });
    return serialize_role(role);
  });
}

export async function update_role(
  input: UpdateRoleInput,
  expected: ExpectedRole,
  client: DatabaseExecutor,
) {
  const changed = await client.roles.updateMany({
    where: { id: input.id, ...expected },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.is_default_role !== undefined
        ? { is_default_role: input.is_default_role }
        : {}),
      updated_at: new Date(),
    },
  });
  if (!changed.count) return null;
  if (input.pages !== undefined) {
    await client.role_pages.deleteMany({ where: { role_id: input.id } });
    if (input.pages.length)
      await client.role_pages.createMany({
        data: input.pages.map((page_key) => ({ role_id: input.id, page_key })),
      });
  }
  if (input.permissions !== undefined) {
    await client.role_permissions.deleteMany({ where: { role_id: input.id } });
    if (input.permissions.length)
      await client.role_permissions.createMany({
        data: input.permissions.map((permission_key) => ({
          role_id: input.id,
          permission_key,
        })),
      });
  }
  return list_by_id_role(input.id, client);
}

export async function delete_role(
  id: string,
  expected: ExpectedRole,
  client: DatabaseExecutor,
) {
  const removed = await client.roles.deleteMany({ where: { id, ...expected } });
  return removed.count > 0;
}

// Prisma contains uses LIKE; escape wildcards so searches retain literal substring behavior.
function literal_contains(value: string): Prisma.StringFilter {
  return { contains: value.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" };
}
