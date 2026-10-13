import { record_where, allowed_company_ids, type RecordAccess } from "@/server/auth/record-access";
import { build_sort, type Sorting } from "@/server/lib/sorting";
import type { Prisma } from "@/generated/prisma/client";
import { getDatabase, type DatabaseExecutor } from "@/server/lib/database";
import type { QuickFilterState } from "@/lib/quick-filter";
import { build_filter } from "@/server/lib/filter";
import type {
  CreateUserInput,
  UpdateUserInput,
  UserSummary,
} from "@/server/schema/users_schema";
import { paginationMetadata, type Pagination } from "@/server/lib/pagination";

const role_select = {
  id: true,
  name: true,
  slug: true,
  company_id: true,
} satisfies Prisma.rolesSelect;
const user_has_membership: Prisma.userWhereInput = {
  user_companies: { some: {} },
};
const user_has_role: Prisma.userWhereInput = {
  OR: [
    { user_roles: { some: {} } },
    { user_companies: { some: { roles: { some: {} } } } },
  ],
};

const user_select = {
  id: true,
  name: true,
  email: true,
  created_by: true,
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

/** Convert a selected user record into the API summary, with an ISO creation date and flattened role and company assignments. */
function serialize_user(user: UserRecord, createdByName: string | null): UserSummary {
  const { user_roles, user_companies, ...record } = user;
  return {
    ...record,
    created_by_name: createdByName,
    created_at: record.created_at.toISOString(),
    global_roles: user_roles.map((assignment) => assignment.role),
    companies: user_companies.map((membership) => ({
      ...membership.company,
      roles: membership.roles.map((assignment) => assignment.role),
    })),
  };
}

/** Resolve creator ids to display names. Missing or deleted creators stay unnamed. */
async function serialize_users(users: UserRecord[], client: DatabaseExecutor) {
  const ids = [...new Set(users.flatMap((user) => user.created_by ? [user.created_by] : []))];
  const creators = ids.length
    ? await client.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    : [];
  const names = new Map(creators.map((creator) => [creator.id, creator.name]));
  return users.map((user) => serialize_user(user, user.created_by ? names.get(user.created_by) ?? null : null));
}

/** Return a sorted page of users matching text search, column conditions, creation dates and assignment filters. Rows and the matching total are read from the same database snapshot before returning pagination metadata. */
export async function list_user(
  pagination: Pagination,
  search: string,
  filters?: QuickFilterState,
  sorting?: Sorting,
  access?: RecordAccess,
) {
  const where = build_filter<Prisma.userWhereInput>(filters, {
    where: record_where(access, "users"),
    search: {
      value: search,
      fields: [(filter) => ({ name: filter }), (filter) => ({ email: filter })],
    },
    fields: {
      name: (values) => ({
        OR: values.map((value) => ({
          name: { equals: value, mode: "insensitive" },
        })),
      }),
      email: (values) => ({
        OR: values.map((value) => ({
          email: { equals: value, mode: "insensitive" },
        })),
      }),
      company: (values) => ({
        user_companies: { some: { company_id: { in: values } } },
      }),
      role: (values) => ({
        OR: [
          { user_roles: { some: { role_id: { in: values } } } },
          {
            user_companies: {
              some: { roles: { some: { role_id: { in: values } } } },
            },
          },
        ],
      }),
    },
    date: (range) => ({ created_at: range }),
    status: { assigned: user_has_role, unassigned: { NOT: user_has_role } },
    additional: {
      membership: {
        assigned: user_has_membership,
        unassigned: { NOT: user_has_membership },
      },
    },
  });
  const orderBy = build_sort<Prisma.userOrderByWithRelationInput>(sorting, {
    fields: {
      id: (direction) => ({ id: direction }),
      name: (direction) => ({ name: direction }),
      email: (direction) => ({ email: direction }),
      created_at: (direction) => ({ created_at: direction }),
      updated_at: (direction) => ({ updated_at: direction }),
    },
    default: { field: "created_at", direction: "desc" },
    tieBreaker: { field: "id", order: { id: "asc" } },
  });
  return getDatabase().$transaction(
    async (tx) => {
      const users = await tx.user.findMany({
        where,
        select: user_select,
        orderBy,
        skip: pagination.skip,
        take: pagination.take,
      });
      const total = await tx.user.count({ where });
      return {
        users: await serialize_users(users, tx),
        ...paginationMetadata(total, pagination),
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}

/** Find a user by ID and include their global roles and company memberships. Return null when no matching user exists. */
export async function list_by_id_user(
  id: string,
  client: DatabaseExecutor = getDatabase(),
) {
  const user = await client.user.findUnique({
    where: { id },
    select: user_select,
  });
  return user ? (await serialize_users([user], client))[0] : null;
}

/** Create the user profile using the Auth account ID, optionally creating a company membership and company role assignments in the same transaction. Return the saved user summary. */
export async function create_user(id: string, input: CreateUserInput, createdBy?: string) {
  return getDatabase().$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        id,
        name: input.name,
        email: input.email,
        created_by: createdBy,
        ...(input.company_id !== undefined
          ? {
              user_companies: {
                create: {
                  company_id: input.company_id,
                  ...(input.role_ids?.length
                    ? {
                        roles: {
                          create: input.role_ids.map((role_id) => ({
                            role_id,
                            scope: "company" as const,
                          })),
                        },
                      }
                    : {}),
                },
              },
            }
          : {}),
      },
      select: user_select,
    });
    return (await serialize_users([user], tx))[0];
  });
}

/** Update the supplied name and email fields for a user and return their current summary. Omitted fields retain their existing values. */
export async function update_user(
  input: UpdateUserInput,
  client: DatabaseExecutor = getDatabase(),
) {
  const user = await client.user.update({
    where: { id: input.id },
    data: { name: input.name, email: input.email },
    select: user_select,
  });
  return (await serialize_users([user], client))[0];
}

/** Delete the user profile by ID; database cascades remove its role and company assignments. This query does not delete the separate Supabase Auth account. */
export async function delete_user(
  id: string,
  client: DatabaseExecutor = getDatabase(),
) {
  await client.user.delete({ where: { id } });
}

/** Load distinct names and non-null emails, company and role choices, and overall role and membership counts for the filter panel. These values describe the full dataset and are read from one consistent snapshot. */
export async function get_user_filter_data(access?: RecordAccess) {
  const visible = record_where(access, "users");
  return getDatabase().$transaction(
    async (tx) => {
      const names = await tx.user.groupBy({
        by: ["name"],
        where: visible,
        _count: { _all: true },
        orderBy: { name: "asc" },
      });
      const emails = await tx.user.groupBy({
        by: ["email"],
        where: { AND: [visible, { email: { not: null } }] },
        _count: { _all: true },
        orderBy: { email: "asc" },
      });
      const companies = await tx.company.findMany({
        where: access && !access.superAdmin ? { user_companies: { some: { user: visible } } } : {},
        select: {
          id: true,
          name: true,
          _count: { select: { user_companies: { where: { user: visible } } } },
        },
        orderBy: { name: "asc" },
      });
      const roles = await tx.roles.findMany({
        where: access && !access.superAdmin ? { OR: [{ user_roles: { some: { user: visible } } }, { company_roles: { some: { membership: { user: visible } } } }] } : {},
        select: { id: true, name: true, scope: true },
        orderBy: { name: "asc" },
      });
      const total = await tx.user.count({ where: visible });
      const assigned = await tx.user.count({ where: { AND: [visible, user_has_role] } });
      const members = await tx.user.count({ where: { AND: [visible, user_has_membership] } });
      return {
        names: names.map((row) => ({ name: row.name, count: row._count._all })),
        emails: emails.map((row) => ({
          email: row.email!,
          count: row._count._all,
        })),
        companies: companies.map(({ _count, ...company }) => ({
          ...company,
          count: _count.user_companies,
        })),
        roles,
        total,
        assigned,
        members,
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}

/** Load all companies and company-scoped roles for the user creation form. Sort both choice lists by name and ID for stable ordering. */
export async function get_user_option(access?: RecordAccess) {
  const companyIds = allowed_company_ids(access, "users");
  const db = getDatabase();
  const [companies, roles] = await Promise.all([
    db.company.findMany({
      where: companyIds ? { id: { in: companyIds } } : {},
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    db.roles.findMany({
      where: { scope: "company", ...(access && !access.superAdmin ? { id: { in: [] } } : {}) },
      select: role_select,
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
  ]);
  return { companies, roles };
}

/** Look up an existing account by email without case sensitivity, the selected company, and the number of selected company-scoped roles that exist. The service uses these results to check creation eligibility before provisioning the Auth account. */
export async function assignable_user(input: CreateUserInput): Promise<{
  existingUser: { id: string } | null;
  company: { id: string } | null;
  roleCount: number;
}> {
  const db = getDatabase();
  const roleIds = input.role_ids ?? [];
  const [existingUser, company, roleCount] = await Promise.all([
    db.user.findFirst({
      where: { email: { equals: input.email, mode: "insensitive" } },
      select: { id: true },
    }),
    input.company_id === undefined
      ? null
      : db.company.findUnique({
          where: { id: input.company_id },
          select: { id: true },
        }),
    roleIds.length
      ? db.roles.count({ where: { id: { in: roleIds }, scope: "company", OR: [{ company_id: null }, { company_id: input.company_id }] } })
      : 0,
  ]);
  return { existingUser, company, roleCount };
}
