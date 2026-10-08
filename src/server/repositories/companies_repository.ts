import { asc, count, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { getDatabase, type DatabaseExecutor } from "@/server/utils/database";
import { companyTable, userCompanyTable } from "@/server/utils/database_schema";
import { containsText } from "@/server/utils/user_filter";
import type {
  CreateCompanyInput,
  UpdateCompanyInput,
  CompanySummary,
} from "@/server/schema/companies_schema";
import { paginationMetadata, type Pagination } from "@/server/utils/pagination";

const companySelect = {
  ...getTableColumns(companyTable),
  member_count: sql`(select count(*) from ${userCompanyTable}
    where ${userCompanyTable}.${sql.identifier("company_id")} = ${companyTable}.${sql.identifier("id")})`.mapWith(
    Number,
  ),
};
type CompanyRecord = typeof companyTable.$inferSelect & {
  member_count: number;
};
function serialize_company(company: CompanyRecord): CompanySummary {
  return {
    ...company,
    created_at: company.created_at.toISOString(),
    updated_at: company.updated_at.toISOString(),
  };
}

export async function list_company(pagination: Pagination, search: string) {
  const where = search ? containsText(companyTable.name, search) : undefined;
  return getDatabase().transaction(
    async (tx) => {
      const rows = await tx
        .select(companySelect)
        .from(companyTable)
        .where(where)
        .orderBy(desc(companyTable.created_at), asc(companyTable.id))
        .offset(pagination.skip)
        .limit(pagination.take);
      const [totals] = await tx
        .select({ total: count() })
        .from(companyTable)
        .where(where);
      return {
        companies: rows.map(serialize_company),
        ...paginationMetadata(totals.total, pagination),
      };
    },
    { isolationLevel: "repeatable read" },
  );
}

export async function list_by_id_company(
  id: string,
  client: DatabaseExecutor = getDatabase(),
  lock = false,
) {
  // Lock before reading membership counts. Membership inserts need a
  // conflicting foreign-key lock, so deletion cannot cascade new members.
  if (lock)
    await client
      .select({ id: companyTable.id })
      .from(companyTable)
      .where(eq(companyTable.id, id))
      .for("update");
  const [company] = await client
    .select(companySelect)
    .from(companyTable)
    .where(eq(companyTable.id, id))
    .limit(1);
  return company ? serialize_company(company) : null;
}

export async function create_company(input: CreateCompanyInput) {
  const [company] = await getDatabase()
    .insert(companyTable)
    .values(input)
    .returning();
  return serialize_company({ ...company, member_count: 0 });
}

export async function update_company(
  input: UpdateCompanyInput,
  client: DatabaseExecutor,
) {
  const [company] = await client
    .update(companyTable)
    .set({ name: input.name, updated_at: new Date() })
    .where(eq(companyTable.id, input.id))
    .returning(companySelect);
  return serialize_company(company);
}

export async function delete_company(id: string, client: DatabaseExecutor) {
  await client.delete(companyTable).where(eq(companyTable.id, id));
}
