import type { Prisma } from "@/generated/prisma/client";
import { getDatabase, type DatabaseExecutor } from "@/server/lib/database";
import type {
  CreateRoleInput,
  UpdateRoleInput,
  RoleSummary,
  RoleScope,
} from "@/server/schema/roles_schema";
import { build_filter } from "@/server/lib/filter";
import { paginationMetadata, type Pagination } from "@/server/lib/pagination";

const role_include = {
  pages: { select: { page_key: true }, orderBy: { page_key: "asc" } },
  permissions: {
    select: {
      permission_key: true,
    },
    orderBy: {
      permission_key: "asc",
    },
  },
  _count: { select: { user_roles: true, company_roles: true } },
} satisfies Prisma.rolesInclude;

type RoleRecord = Prisma.rolesGetPayload<{
  include: typeof role_include;
}>;
type ExpectedRole = Pick<RoleSummary, "is_system" | "slug" | "scope">;

/** Convert role timestamps to ISO strings and flatten page and permission mappings into their keys. Sum global and company role assignments into assignment_count. */
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

/** Return a page of roles matching a literal, case-insensitive name or slug search and an optional scope. Include access mappings and assignment counts, reading rows and the matching total from one snapshot. */
export async function list_role(
  pagination: Pagination,
  search: string,
  scope?: RoleScope,
) {
  const where = build_filter<Prisma.rolesWhereInput>(undefined, {
    where: scope ? { scope } : undefined,
    search: {
      value: search,
      fields: [(filter) => ({ name: filter }), (filter) => ({ slug: filter })],
    },
  });
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

/** Find a role by ID with its page keys, permission keys and assignment counts. Return null when the role does not exist. */
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

/** Create a non-system role with the supplied scope and default setting, plus its page and permission mappings in one transaction. Return the saved role summary. */
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

/** Update a role only if its system flag, slug and scope still match the values checked by the service, returning null when they no longer match. Supplied page and permission lists replace their existing mappings through the same transaction client, and empty lists clear them. */
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

/** Delete a role only if its system flag, slug and scope still match the values checked by the service. Return whether a row was deleted so the service can detect a concurrent change. */
export async function delete_role(
  id: string,
  expected: ExpectedRole,
  client: DatabaseExecutor,
) {
  const removed = await client.roles.deleteMany({ where: { id, ...expected } });
  return removed.count > 0;
}
