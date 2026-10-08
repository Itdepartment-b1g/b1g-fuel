import type { Prisma } from "@/generated/prisma/client";
import { getDatabase } from "@/server/utils/database";
import { groupActiveConditions, resolveDateRange, type QuickFilterState } from "@/lib/quick-filter";
import type { CreateUserInput, UserSummary } from "@/server/schema/users_schema";
import { paginationMetadata, type Pagination } from "@/server/utils/pagination";

const role_select = { id: true, name: true, slug: true } satisfies Prisma.rolesSelect;
const user_select = {
  id: true,
  name: true,
  email: true,
  created_at: true,
  user_roles: {
    select: { role: { select: role_select } },
    orderBy: [{ role: { name: "asc" } }, { role: { id: "asc" } }],
  },
  user_companies: {
    select: {
      company: { select: { id: true, name: true } },
      roles: {
        select: { role: { select: role_select } },
        orderBy: [{ role: { name: "asc" } }, { role: { id: "asc" } }],
      },
    },
    orderBy: [{ company: { name: "asc" } }, { company: { id: "asc" } }],
  },
} satisfies Prisma.userSelect;
type UserRecord = Prisma.userGetPayload<{ select: typeof user_select }>;

function serialize_user(user: UserRecord): UserSummary {
  const { user_roles, user_companies, ...record } = user;
  return {
    ...record,
    created_at: record.created_at.toISOString(),
    global_roles: user_roles.map((assignment) => assignment.role),
    companies: user_companies.map((membership) => ({
      ...membership.company,
      roles: membership.roles.map((assignment) => assignment.role),
    })),
  };
}

export async function list_user(pagination: Pagination, search: string, filters?: QuickFilterState) {
  const where: Prisma.userWhereInput = { AND: [build_user_search(search) ?? {}, build_user_filter(filters) ?? {}] };
  return getDatabase().$transaction(async (tx) => {
    const users = await tx.user.findMany({
      where,
      select: user_select,
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      skip: pagination.skip,
      take: pagination.take,
    });
    const total = await tx.user.count({ where });
    return { users: users.map(serialize_user), ...paginationMetadata(total, pagination) };
  }, { isolationLevel: "RepeatableRead" });
}

export async function get_user_filter_data() {
  return getDatabase().$transaction(async (tx) => {
    const names = await tx.user.groupBy({ by: ["name"], _count: { _all: true }, orderBy: { name: "asc" } });
    const emails = await tx.user.groupBy({ by: ["email"], where: { email: { not: null } }, _count: { _all: true }, orderBy: { email: "asc" } });
    const companies = await tx.company.findMany({
      select: { id: true, name: true, _count: { select: { user_companies: true } } },
      orderBy: { name: "asc" },
    });
    const roles = await tx.roles.findMany({ select: { id: true, name: true, scope: true }, orderBy: { name: "asc" } });
    const total = await tx.user.count();
    const assigned = await tx.user.count({ where: user_has_role });
    const members = await tx.user.count({ where: user_has_membership });
    return {
      names: names.map((row) => ({ name: row.name, count: row._count._all })),
      emails: emails.map((row) => ({ email: row.email!, count: row._count._all })),
      companies: companies.map(({ _count, ...company }) => ({ ...company, count: _count.user_companies })),
      roles, total, assigned, members,
    };
  }, { isolationLevel: "RepeatableRead" });
}

export async function get_user_option() {
  const db = getDatabase();
  const [companies, roles] = await Promise.all([
    db.company.findMany({ select: { id: true, name: true }, orderBy: [{ name: "asc" }, { id: "asc" }] }),
    db.roles.findMany({ where: { scope: "company" }, select: role_select, orderBy: [{ name: "asc" }, { id: "asc" }] }),
  ]);
  return { companies, roles };
}

export async function assignable_user(input: CreateUserInput): Promise<{
  existingUser: { id: string } | null;
  company: { id: string } | null;
  roleCount: number;
}> {
  const db = getDatabase();
  const roleIds = input.role_ids ?? [];
  const [existingUser, company, roleCount] = await Promise.all([
    db.user.findFirst({ where: { email: { equals: input.email, mode: "insensitive" } }, select: { id: true } }),
    input.company_id === undefined ? null : db.company.findUnique({ where: { id: input.company_id }, select: { id: true } }),
    roleIds.length ? db.roles.count({ where: { id: { in: roleIds }, scope: "company" } }) : 0,
  ]);
  return { existingUser, company, roleCount };
}

export async function create_user(id: string, input: CreateUserInput) {
  return getDatabase().$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        id, name: input.name, email: input.email,
        ...(input.company_id !== undefined ? {
          user_companies: {
            create: {
              company_id: input.company_id,
              ...(input.role_ids?.length ? {
                roles: { create: input.role_ids.map((role_id) => ({ role_id, scope: "company" as const })) },
              } : {}),
            },
          },
        } : {}),
      },
      select: user_select,
    });
    return serialize_user(user);
  });
}

// Prisma contains uses LIKE; escape wildcards so searches retain literal substring behavior.
function literal_contains(value: string): Prisma.StringFilter {
  return { contains: value.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" };
}
const user_has_membership: Prisma.userWhereInput = { user_companies: { some: {} } };
const user_has_role: Prisma.userWhereInput = { OR: [
  { user_roles: { some: {} } },
  { user_companies: { some: { roles: { some: {} } } } },
] };

export function build_user_filter(filters?: QuickFilterState, now = new Date()): Prisma.userWhereInput | undefined {
  if (!filters) return undefined;
  const clauses: Prisma.userWhereInput[] = [];
  for (const [field, values] of groupActiveConditions(filters.conditions)) {
    if (field === "name" || field === "email") clauses.push({ OR: values.map((value) => ({ [field]: { equals: value, mode: "insensitive" } })) });
    else if (field === "company") clauses.push({ user_companies: { some: { company_id: { in: values } } } });
    else if (field === "role") clauses.push({ OR: [
      { user_roles: { some: { role_id: { in: values } } } },
      { user_companies: { some: { roles: { some: { role_id: { in: values } } } } } },
    ] });
  }
  const range = resolveDateRange(filters.date, now);
  if (range.from || range.toExclusive) clauses.push({ created_at: { ...(range.from ? { gte: range.from } : {}), ...(range.toExclusive ? { lt: range.toExclusive } : {}) } });
  if (filters.status === "assigned") clauses.push(user_has_role);
  else if (filters.status === "unassigned") clauses.push({ NOT: user_has_role });
  if (filters.additional.membership === "assigned") clauses.push(user_has_membership);
  else if (filters.additional.membership === "unassigned") clauses.push({ NOT: user_has_membership });
  return clauses.length ? { AND: clauses } : undefined;
}

function build_user_search(search: string): Prisma.userWhereInput | undefined {
  return search ? { OR: [{ name: literal_contains(search) }, { email: literal_contains(search) }] } : undefined;
}
