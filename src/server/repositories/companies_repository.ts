import { record_where, type RecordAccess } from "@/server/auth/record-access";
import { build_sort, type Sorting } from "@/server/lib/sorting";
import type { Prisma } from "@/generated/prisma/client";
import { getDatabase, type DatabaseExecutor } from "@/server/lib/database";
import type {
  CreateCompanyInput,
  UpdateCompanyInput,
  CompanySummary,
} from "@/server/schema/companies_schema";
import { build_filter } from "@/server/lib/filter";
import { paginationMetadata, type Pagination } from "@/server/lib/pagination";

const company_include = {
  _count: { select: { user_companies: true } },
} satisfies Prisma.companyInclude;
type CompanyRecord = Prisma.companyGetPayload<{
  include: typeof company_include;
}>;

/** Convert company timestamps to ISO strings and expose the membership count as member_count in the API summary. */
function serialize_company(company: CompanyRecord): CompanySummary {
  const { _count, ...record } = company;
  return {
    ...record,
    created_at: record.created_at.toISOString(),
    updated_at: record.updated_at.toISOString(),
    member_count: _count.user_companies,
  };
}

/** Return a sorted page of companies matching a literal, case-insensitive name search, including their membership counts. Read the rows and matching total from the same database snapshot. */
export async function list_company(pagination: Pagination, search: string, sorting?: Sorting, access?: RecordAccess) {
  const where = build_filter<Prisma.companyWhereInput>(undefined, {
    where: record_where(access, "companies"),
    search: { value: search, fields: [(filter) => ({ name: filter })] },
  });
  const orderBy = build_sort<Prisma.companyOrderByWithRelationInput>(sorting, {
    fields: {
      id: (direction) => ({ id: direction }),
      name: (direction) => ({ name: direction }),
      created_at: (direction) => ({ created_at: direction }),
      updated_at: (direction) => ({ updated_at: direction }),
    },
    default: { field: "created_at", direction: "desc" },
    tieBreaker: { field: "id", order: { id: "asc" } },
  });
  return getDatabase().$transaction(
    async (tx) => {
      const companies = await tx.company.findMany({
        where,
        include: company_include,
        orderBy,
        skip: pagination.skip,
        take: pagination.take,
      });
      const total = await tx.company.count({ where });
      return {
        companies: companies.map(serialize_company),
        ...paginationMetadata(total, pagination),
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}

/** Find a company by ID with its membership count, returning null when it does not exist. When requested, acquire a row lock through the supplied client before reading the count. */
export async function list_by_id_company(
  id: string,
  client: DatabaseExecutor = getDatabase(),
  lock = false,
  access?: RecordAccess,
  action = "view",
) {
  // Keep the row lock before reading membership counts to protect against concurrent inserts.
  if (lock)
    await client.$queryRaw`select id from "company" where id = ${id}::uuid for update`;
  const company = await client.company.findFirst({
    where: { AND: [{ id }, record_where(access, "companies", action)] },
    include: company_include,
  });
  return company ? serialize_company(company) : null;
}

/** Insert a company with the supplied name and return its API summary, including timestamps and membership count. */
export async function create_company(input: CreateCompanyInput, createdBy?: string) {
  return serialize_company(
    await getDatabase().company.create({
      data: { ...input, created_by: createdBy },
      include: company_include,
    }),
  );
}

/** Update the company name through the supplied database client and return the updated summary. The service supplies its transaction client to keep the write within its business checks. */
export async function update_company(
  input: UpdateCompanyInput,
  client: DatabaseExecutor,
  access?: RecordAccess,
) {
  return serialize_company(
    await client.company.update({
      where: { id: input.id, AND: [record_where(access, "companies", "edit")] },
      data: { name: input.name },
      include: company_include,
    }),
  );
}

/** Delete a company by ID through the supplied database client. The service checks membership and controls the transaction before calling this query. */
export async function delete_company(id: string, client: DatabaseExecutor, access?: RecordAccess) {
  await client.company.delete({ where: { id, AND: [record_where(access, "companies", "delete")] } });
}
