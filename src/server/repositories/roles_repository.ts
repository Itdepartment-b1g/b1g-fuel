import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  or,
  sql,
} from "drizzle-orm";
import { getDatabase, type DatabaseExecutor } from "@/server/utils/database";
import {
  roleTable,
  rolePageTable,
  rolePermissionTable,
  userRoleTable,
  userCompanyRoleTable,
} from "@/server/utils/database_schema";
import { containsText } from "@/server/utils/user_filter";
import type {
  CreateRoleInput,
  UpdateRoleInput,
  RoleSummary,
  RoleScope,
} from "@/server/schema/roles_schema";
import { paginationMetadata, type Pagination } from "@/server/utils/pagination";

const roleSelect = {
  ...getTableColumns(roleTable),
  pages: sql<
    string[]
  >`array(select ${rolePageTable.page_key} from ${rolePageTable}
    where ${rolePageTable}.${sql.identifier("role_id")} = ${roleTable}.${sql.identifier("id")} order by ${rolePageTable.page_key})`,
  permissions: sql<
    string[]
  >`array(select ${rolePermissionTable.permission_key} from ${rolePermissionTable}
    where ${rolePermissionTable}.${sql.identifier("role_id")} = ${roleTable}.${sql.identifier("id")} order by ${rolePermissionTable.permission_key})`,
  assignment_count:
    sql`(select count(*) from ${userRoleTable} where ${userRoleTable}.${sql.identifier("role_id")} = ${roleTable}.${sql.identifier("id")})
    + (select count(*) from ${userCompanyRoleTable} where ${userCompanyRoleTable}.${sql.identifier("role_id")} = ${roleTable}.${sql.identifier("id")})`.mapWith(
      Number,
    ),
};
type RoleRecord = typeof roleTable.$inferSelect & {
  pages: string[];
  permissions: string[];
  assignment_count: number;
};
type ExpectedRole = Pick<RoleSummary, "is_system" | "slug" | "scope">;
function serialize_role(role: RoleRecord): RoleSummary {
  return {
    ...role,
    created_at: role.created_at.toISOString(),
    updated_at: role.updated_at.toISOString(),
  };
}
export async function list_role(
  pagination: Pagination,
  search: string,
  scope?: RoleScope,
) {
  const where = and(
    scope ? eq(roleTable.scope, scope) : undefined,
    search
      ? or(
          containsText(roleTable.name, search),
          containsText(roleTable.slug, search),
        )
      : undefined,
  );
  return getDatabase().transaction(
    async (tx) => {
      const rows = await tx
        .select(roleSelect)
        .from(roleTable)
        .where(where)
        .orderBy(desc(roleTable.created_at), asc(roleTable.id))
        .offset(pagination.skip)
        .limit(pagination.take);
      const [totals] = await tx
        .select({ total: count() })
        .from(roleTable)
        .where(where);
      return {
        roles: rows.map(serialize_role),
        ...paginationMetadata(totals.total, pagination),
      };
    },
    { isolationLevel: "repeatable read" },
  );
}

export async function list_by_id_role(
  id: string,
  client: DatabaseExecutor = getDatabase(),
) {
  const [role] = await client
    .select(roleSelect)
    .from(roleTable)
    .where(eq(roleTable.id, id))
    .limit(1);
  return role ? serialize_role(role) : null;
}

export async function create_role(input: Required<CreateRoleInput>) {
  return getDatabase().transaction(async (client) => {
    const [role] = await client
      .insert(roleTable)
      .values({
        name: input.name,
        slug: input.slug,
        scope: input.scope,
        is_system: false,
        is_default_role: input.is_default_role,
      })
      .returning();
    if (input.pages.length)
      await client
        .insert(rolePageTable)
        .values(
          input.pages.map((page_key) => ({ role_id: role.id, page_key })),
        );
    if (input.permissions.length)
      await client.insert(rolePermissionTable).values(
        input.permissions.map((permission_key) => ({
          role_id: role.id,
          permission_key,
        })),
      );
    return serialize_role({
      ...role,
      pages: input.pages.toSorted(),
      permissions: input.permissions.toSorted(),
      assignment_count: 0,
    });
  });
}

export async function update_role(
  input: UpdateRoleInput,
  expected: ExpectedRole,
  client: DatabaseExecutor,
) {
  const changed = await client
    .update(roleTable)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.is_default_role !== undefined
        ? { is_default_role: input.is_default_role }
        : {}),
      updated_at: new Date(),
    })
    .where(
      and(
        eq(roleTable.id, input.id),
        eq(roleTable.is_system, expected.is_system),
        eq(roleTable.slug, expected.slug),
        eq(roleTable.scope, expected.scope),
      ),
    )
    .returning({ id: roleTable.id });
  if (!changed.length) return null;
  if (input.pages !== undefined) {
    await client
      .delete(rolePageTable)
      .where(eq(rolePageTable.role_id, input.id));
    if (input.pages.length)
      await client
        .insert(rolePageTable)
        .values(
          input.pages.map((page_key) => ({ role_id: input.id, page_key })),
        );
  }
  if (input.permissions !== undefined) {
    await client
      .delete(rolePermissionTable)
      .where(eq(rolePermissionTable.role_id, input.id));
    if (input.permissions.length)
      await client.insert(rolePermissionTable).values(
        input.permissions.map((permission_key) => ({
          role_id: input.id,
          permission_key,
        })),
      );
  }
  return list_by_id_role(input.id, client);
}

export async function delete_role(
  id: string,
  expected: ExpectedRole,
  client: DatabaseExecutor,
) {
  const removed = await client
    .delete(roleTable)
    .where(
      and(
        eq(roleTable.id, id),
        eq(roleTable.is_system, expected.is_system),
        eq(roleTable.slug, expected.slug),
        eq(roleTable.scope, expected.scope),
      ),
    )
    .returning({ id: roleTable.id });
  return removed.length > 0;
}
