import type { Prisma } from "@/generated/prisma/client";
import { getDatabase, type DatabaseExecutor } from "@/server/utils/database";
import type {
  CreateCompanyInput,
  UpdateCompanyInput,
  CompanySummary,
} from "@/server/schema/companies_schema";
import { paginationMetadata, type Pagination } from "@/server/utils/pagination";

const company_include = {
  _count: { select: { user_companies: true } },
} satisfies Prisma.companyInclude;
type CompanyRecord = Prisma.companyGetPayload<{
  include: typeof company_include;
}>;

function serialize_company(company: CompanyRecord): CompanySummary {
  const { _count, ...record } = company;
  return {
    ...record,
    created_at: record.created_at.toISOString(),
    updated_at: record.updated_at.toISOString(),
    member_count: _count.user_companies,
  };
}

export async function list_company(pagination: Pagination, search: string) {
  const where: Prisma.companyWhereInput = search
    ? { name: literal_contains(search) }
    : {};
  return getDatabase().$transaction(
    async (tx) => {
      const companies = await tx.company.findMany({
        where,
        include: company_include,
        orderBy: [{ created_at: "desc" }, { id: "asc" }],
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

export async function list_by_id_company(
  id: string,
  client: DatabaseExecutor = getDatabase(),
  lock = false,
) {
  // Keep the row lock before reading membership counts to protect against concurrent inserts.
  if (lock)
    await client.$queryRaw`select id from "company" where id = ${id}::uuid for update`;
  const company = await client.company.findUnique({
    where: { id },
    include: company_include,
  });
  return company ? serialize_company(company) : null;
}

export async function create_company(input: CreateCompanyInput) {
  return serialize_company(
    await getDatabase().company.create({
      data: input,
      include: company_include,
    }),
  );
}

export async function update_company(
  input: UpdateCompanyInput,
  client: DatabaseExecutor,
) {
  return serialize_company(
    await client.company.update({
      where: { id: input.id },
      data: { name: input.name },
      include: company_include,
    }),
  );
}

export async function delete_company(id: string, client: DatabaseExecutor) {
  await client.company.delete({ where: { id } });
}

// Prisma contains uses LIKE; escape wildcards so searches retain literal substring behavior.
function literal_contains(value: string): Prisma.StringFilter {
  return { contains: value.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" };
}
