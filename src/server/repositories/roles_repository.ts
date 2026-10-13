import type { QuickFilterState } from "@/lib/quick-filter";
import { record_where, type RecordAccess } from "@/server/auth/record-access";
import { build_sort, type Sorting } from "@/server/lib/sorting";
import type { Prisma } from "@/generated/prisma/client";
import { getDatabase, type DatabaseExecutor } from "@/server/lib/database";
import type {
  CreateRoleInput,
  UpdateRoleInput,
  RoleSummary,
  RoleScope,
} from "@/server/schema/roles_schema";
import type { AccessScope } from "@/lib/auth/access-scope";
import { build_filter } from "@/server/lib/filter";
import { paginationMetadata, type Pagination } from "@/server/lib/pagination";

const role_include = {
  company: { select: { id: true, name: true } },
  pages: { select: { page_key: true }, orderBy: { page_key: "asc" } },
  permissions: {
    select: {
      permission_key: true,
      access_scope: true,
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
    permission_scopes: Object.fromEntries(permissions.filter((permission) => !permission.permission_key.endsWith(".add")).map((permission) => [permission.permission_key, permission.access_scope as AccessScope])),
    assignment_count: _count.user_roles + _count.company_roles,
  };
}

/** Return a sorted page of roles matching a literal, case-insensitive name or slug search and an optional scope. Include access mappings and assignment counts, reading rows and the matching total from one snapshot. */
export async function list_role(
  pagination: Pagination,
  search: string,
  scope?: RoleScope,
  sorting?: Sorting,
  access?: RecordAccess,
  filters?: QuickFilterState,
) {
  const where = build_filter<Prisma.rolesWhereInput>(filters, {
    where: { AND: [scope ? { scope } : {}, record_where(access, "roles")] },
    fields: {
      name: (values) => ({ OR: values.map((name) => ({ name: { equals: name, mode: "insensitive" } })) }),
      slug: (values) => ({ OR: values.map((slug) => ({ slug: { equals: slug, mode: "insensitive" } })) }),
      company: (values) => ({ company_id: { in: values } }),
    },
    date: (range) => ({ created_at: range }),
    status: {
      assigned: { OR: [{ user_roles: { some: {} } }, { company_roles: { some: {} } }] },
      unassigned: { user_roles: { none: {} }, company_roles: { none: {} } },
    },
    additional: {
      scope: { company: { scope: "company" }, global: { scope: "global" } },
      type: { system: { is_system: true }, custom: { is_system: false } },
      default: { default: { is_default_role: true }, other: { is_default_role: false } },
    },
    search: {
      value: search,
      fields: [(filter) => ({ name: filter }), (filter) => ({ slug: filter })],
    },
  });
  const orderBy = build_sort<Prisma.rolesOrderByWithRelationInput>(sorting, {
    fields: {
      id: (direction) => ({ id: direction }),
      name: (direction) => ({ name: direction }),
      slug: (direction) => ({ slug: direction }),
      scope: (direction) => ({ scope: direction }),
      is_default_role: (direction) => ({ is_default_role: direction }),
      created_at: (direction) => ({ created_at: direction }),
      updated_at: (direction) => ({ updated_at: direction }),
    },
    default: { field: "created_at", direction: "desc" },
    tieBreaker: { field: "id", order: { id: "asc" } },
  });
  return getDatabase().$transaction(
    async (tx) => {
      const roles = await tx.roles.findMany({
        where,
        include: role_include,
        orderBy,
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
  access?: RecordAccess,
) {
  const role = await client.roles.findFirst({
    where: { AND: [{ id }, record_where(access, "roles")] },
    include: role_include,
  });
  return role ? serialize_role(role) : null;
}

/** Create a non-system role with the supplied scope and default setting, plus its page and permission mappings in one transaction. Return the saved role summary. */
export async function create_role(input: Required<CreateRoleInput>, createdBy?: string) {
  return getDatabase().$transaction(async (tx) => {
    const role = await tx.roles.create({
      data: {
        name: input.name,
        created_by: createdBy,
        slug: input.slug,
        scope: input.scope,
        company_id: input.company_id,
        is_system: false,
        is_default_role: input.is_default_role,
        pages: { create: input.pages.map((page_key) => ({ page_key })) },
        permissions: {
          create: input.permissions.map((permission_key) => ({
            permission_key,
            access_scope: input.permission_scopes[permission_key] ?? "company",
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
      ...(input.company_id !== undefined ? { company_id: input.company_id } : {}),
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
          access_scope: input.permission_scopes?.[permission_key] ?? "company",
        })),
      });
  }
  if (input.permission_scopes !== undefined && input.permissions === undefined) {
    for (const [permission_key, access_scope] of Object.entries(input.permission_scopes)) {
      await client.role_permissions.updateMany({ where: { role_id: input.id, permission_key }, data: { access_scope } });
    }
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

export async function get_role_filter_data(access?: RecordAccess) {
  return getDatabase().roles.findMany({
    where: record_where(access, "roles"),
    select: { name: true, slug: true, scope: true, is_system: true, is_default_role: true, company: { select: { id: true, name: true } }, _count: { select: { user_roles: true, company_roles: true } } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}
