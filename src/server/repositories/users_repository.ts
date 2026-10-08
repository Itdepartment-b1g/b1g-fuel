import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  sql,
  type SQL,
} from "drizzle-orm";
import { getDatabase, type DatabaseExecutor } from "@/server/utils/database";
import {
  companyTable,
  roleTable,
  userCompanyRoleTable,
  userCompanyTable,
  userRoleTable,
  userTable,
} from "@/server/utils/database_schema";
import { userHasMembership, userHasRole } from "@/server/utils/user_filter";
import type { CreateUserInput, UserSummary } from "@/server/schema/users_schema";
import { paginationMetadata, type Pagination } from "@/server/utils/pagination";

const roleSelect = {
  id: roleTable.id,
  name: roleTable.name,
  slug: roleTable.slug,
};
const userSelect = {
  id: userTable.id,
  name: userTable.name,
  email: userTable.email,
  created_at: userTable.created_at,
};
type UserRecord = Pick<
  typeof userTable.$inferSelect,
  "id" | "name" | "email" | "created_at"
>;

// Batch related data for the selected page; avoid one query per user or membership.
async function serialize_user(
  client: DatabaseExecutor,
  rows: UserRecord[],
): Promise<UserSummary[]> {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const globalRoles = await client
    .select({ user_id: userRoleTable.user_id, role: roleSelect })
    .from(userRoleTable)
    .innerJoin(
      roleTable,
      and(
        eq(roleTable.id, userRoleTable.role_id),
        eq(roleTable.scope, userRoleTable.scope),
      ),
    )
    .where(inArray(userRoleTable.user_id, ids))
    .orderBy(asc(roleTable.name), asc(roleTable.id));
  const memberships = await client
    .select({
      id: userCompanyTable.id,
      user_id: userCompanyTable.user_id,
      company: { id: companyTable.id, name: companyTable.name },
    })
    .from(userCompanyTable)
    .innerJoin(companyTable, eq(companyTable.id, userCompanyTable.company_id))
    .where(inArray(userCompanyTable.user_id, ids))
    .orderBy(asc(companyTable.name), asc(companyTable.id));
  const membershipRoles = memberships.length
    ? await client
        .select({
          membership_id: userCompanyRoleTable.user_company_id,
          role: roleSelect,
        })
        .from(userCompanyRoleTable)
        .innerJoin(
          roleTable,
          and(
            eq(roleTable.id, userCompanyRoleTable.role_id),
            eq(roleTable.scope, userCompanyRoleTable.scope),
          ),
        )
        .where(
          inArray(
            userCompanyRoleTable.user_company_id,
            memberships.map((row) => row.id),
          ),
        )
        .orderBy(asc(roleTable.name), asc(roleTable.id))
    : [];
  return rows.map((row) => ({
    ...row,
    created_at: row.created_at.toISOString(),
    global_roles: globalRoles
      .filter((item) => item.user_id === row.id)
      .map((item) => item.role),
    companies: memberships
      .filter((item) => item.user_id === row.id)
      .map((item) => ({
        ...item.company,
        roles: membershipRoles
          .filter((assignment) => assignment.membership_id === item.id)
          .map((assignment) => assignment.role),
      })),
  }));
}

export async function list_user(pagination: Pagination, where?: SQL) {
  return getDatabase().transaction(
    async (tx) => {
      const rows = await tx
        .select(userSelect)
        .from(userTable)
        .where(where)
        .orderBy(desc(userTable.created_at), asc(userTable.id))
        .offset(pagination.skip)
        .limit(pagination.take);
      const [totals] = await tx
        .select({ total: count() })
        .from(userTable)
        .where(where);
      return {
        users: await serialize_user(tx, rows),
        ...paginationMetadata(totals.total, pagination),
      };
    },
    { isolationLevel: "repeatable read" },
  );
}

export async function get_user_filter_data() {
  return getDatabase().transaction(
    async (tx) => {
      const names = await tx
        .select({ name: userTable.name, count: count() })
        .from(userTable)
        .groupBy(userTable.name)
        .orderBy(asc(userTable.name));
      const emails = await tx
        .select({ email: userTable.email, count: count() })
        .from(userTable)
        .where(isNotNull(userTable.email))
        .groupBy(userTable.email)
        .orderBy(asc(userTable.email));
      const companies = await tx
        .select({
          id: companyTable.id,
          name: companyTable.name,
          count: sql`(select count(*) from ${userCompanyTable}
        where ${userCompanyTable}.${sql.identifier("company_id")} = ${companyTable}.${sql.identifier("id")})`.mapWith(
            Number,
          ),
        })
        .from(companyTable)
        .orderBy(asc(companyTable.name));
      const roles = await tx
        .select({
          id: roleTable.id,
          name: roleTable.name,
          scope: roleTable.scope,
        })
        .from(roleTable)
        .orderBy(asc(roleTable.name));
      const [totals] = await tx.select({ total: count() }).from(userTable);
      const [assigned] = await tx
        .select({ total: count() })
        .from(userTable)
        .where(userHasRole);
      const [members] = await tx
        .select({ total: count() })
        .from(userTable)
        .where(userHasMembership);
      return {
        names,
        emails,
        companies,
        roles,
        total: totals.total,
        assigned: assigned.total,
        members: members.total,
      };
    },
    { isolationLevel: "repeatable read" },
  );
}

export async function get_user_option() {
  const db = getDatabase();
  const [companies, roles] = await Promise.all([
    db
      .select({ id: companyTable.id, name: companyTable.name })
      .from(companyTable)
      .orderBy(asc(companyTable.name), asc(companyTable.id)),
    db
      .select(roleSelect)
      .from(roleTable)
      .where(eq(roleTable.scope, "company"))
      .orderBy(asc(roleTable.name), asc(roleTable.id)),
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
  const [existing, company, roles] = await Promise.all([
    db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(sql`lower(${userTable.email})`, input.email.toLowerCase()))
      .limit(1),
    input.company_id === undefined
      ? []
      : db
          .select({ id: companyTable.id })
          .from(companyTable)
          .where(eq(companyTable.id, input.company_id))
          .limit(1),
    roleIds.length
      ? db
          .select({ total: count() })
          .from(roleTable)
          .where(
            and(
              inArray(roleTable.id, roleIds),
              eq(roleTable.scope, "company"),
            ),
          )
      : [{ total: 0 }],
  ]);
  return {
    existingUser: existing[0] ?? null,
    company: company[0] ?? null,
    roleCount: roles[0].total,
  };
}

export async function create_user(id: string, input: CreateUserInput) {
  return getDatabase().transaction(async (tx) => {
    const [user] = await tx
      .insert(userTable)
      .values({ id, name: input.name, email: input.email })
      .returning(userSelect);
    if (input.company_id !== undefined) {
      const [membership] = await tx
        .insert(userCompanyTable)
        .values({ user_id: id, company_id: input.company_id })
        .returning({ id: userCompanyTable.id });
      if (input.role_ids?.length)
        await tx.insert(userCompanyRoleTable).values(
          input.role_ids.map((role_id) => ({
            user_company_id: membership.id,
            role_id,
            scope: "company" as const,
          })),
        );
    }
    const [result] = await serialize_user(tx, [user]);
    return result;
  });
}
