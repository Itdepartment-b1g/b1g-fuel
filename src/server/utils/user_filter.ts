import { and, gte, inArray, lt, not, or, sql, type SQL, type AnyColumn } from "drizzle-orm";
import { groupActiveConditions, resolveDateRange, type QuickFilterState } from "@/lib/quick-filter";
import { userCompanyRoleTable, userCompanyTable, userRoleTable, userTable } from "./database_schema";

// Literal substring matching: user input stays parameterized, including % and _ characters.
export function containsText(column: AnyColumn, value: string): SQL {
  return sql`strpos(lower(${column}), lower(${value})) > 0`;
}
export const userHasMembership = sql`exists (select 1 from ${userCompanyTable} where ${userCompanyTable.user_id} = ${userTable.id})`;
export const userHasRole = sql`(exists (select 1 from ${userRoleTable} where ${userRoleTable.user_id} = ${userTable.id}) or exists (
  select 1 from ${userCompanyTable} inner join ${userCompanyRoleTable}
  on ${userCompanyRoleTable.user_company_id} = ${userCompanyTable.id}
  where ${userCompanyTable.user_id} = ${userTable.id}
))`;

export function buildUserFilter(filters?: QuickFilterState, now = new Date()): SQL | undefined {
  if (!filters) return undefined;
  const clauses: SQL[] = [];
  for (const [field, values] of groupActiveConditions(filters.conditions)) {
    if (field === "name" || field === "email")
      clauses.push(inArray(sql`lower(${userTable[field]})`, values.map(value => value.toLowerCase())));
    else if (field === "company")
      clauses.push(sql`exists (select 1 from ${userCompanyTable} where ${userCompanyTable.user_id} = ${userTable.id}
        and ${inArray(userCompanyTable.company_id, values)})`);
    else if (field === "role")
      clauses.push(sql`(exists (select 1 from ${userRoleTable} where ${userRoleTable.user_id} = ${userTable.id}
        and ${inArray(userRoleTable.role_id, values)}) or exists (
        select 1 from ${userCompanyTable} inner join ${userCompanyRoleTable}
        on ${userCompanyRoleTable.user_company_id} = ${userCompanyTable.id}
        where ${userCompanyTable.user_id} = ${userTable.id} and ${inArray(userCompanyRoleTable.role_id, values)}))`);
  }
  const range = resolveDateRange(filters.date, now);
  if (range.from) clauses.push(gte(userTable.created_at, range.from));
  if (range.toExclusive) clauses.push(lt(userTable.created_at, range.toExclusive));
  if (filters.status === "assigned") clauses.push(userHasRole);
  else if (filters.status === "unassigned") clauses.push(not(userHasRole));
  if (filters.additional.membership === "assigned") clauses.push(userHasMembership);
  else if (filters.additional.membership === "unassigned") clauses.push(not(userHasMembership));
  return and(...clauses);
}

export function buildUserSearch(search: string): SQL | undefined {
  return search ? or(containsText(userTable.name, search), containsText(userTable.email, search)) : undefined;
}
