import type { QuickFilterState } from "@/types/quick-filter";
import { record_where, type RecordAccess } from "@/server/auth/record-access";
import { build_sort, type Sorting } from "@/server/lib/sorting";
import type { Prisma } from "@/generated/prisma/client";
import { getDatabase, type DatabaseExecutor } from "@/server/lib/database";
import type {
  CreateCompanyInput,
  CreateCompanyResult,
  UpdateCompanyInput,
  CompanySummary,
  CompanyLocationSummary,
} from "@/server/schema/companies_schema";
import { build_filter } from "@/server/lib/filter";
import { paginationMetadata, type Pagination } from "@/server/lib/pagination";

const company_include = {
  _count: { select: { user_companies: true, locations: true } },
  locations: {
    where: { type: "warehouse" },
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
    take: 1,
    select: { name: true, address: true },
  },
} satisfies Prisma.companyInclude;
type CompanyRecord = Prisma.companyGetPayload<{
  include: typeof company_include;
}>;

/** Convert company timestamps to ISO strings and expose membership, location, and warehouse summary fields. */
function serialize_company(company: CompanyRecord): CompanySummary {
  const { _count, locations, ...record } = company;
  const warehouse = locations[0] ?? null;
  return {
    ...record,
    created_at: record.created_at.toISOString(),
    updated_at: record.updated_at.toISOString(),
    member_count: _count.user_companies,
    location_count: _count.locations,
    is_warehouse: Boolean(warehouse),
    warehouse_name: warehouse?.name ?? null,
    warehouse_address: warehouse?.address ? warehouse.address : null,
  };
}

function serialize_location(location: {
  id: string;
  name: string;
  type: CompanyLocationSummary["type"];
  address: string;
}): CompanyLocationSummary {
  return {
    id: location.id,
    name: location.name,
    type: location.type,
    address: location.address,
  };
}

/** Return a sorted page of companies matching a literal, case-insensitive name search, including their membership counts. Read the rows and matching total from the same database snapshot. */
export async function list_company(pagination: Pagination, search: string, sorting?: Sorting, access?: RecordAccess, filters?: QuickFilterState) {
  const where = build_filter<Prisma.companyWhereInput>(filters, {
    where: record_where(access, "companies"),
    fields: { name: (values) => ({ OR: values.map((name) => ({ name: { equals: name, mode: "insensitive" } })) }) },
    date: (range) => ({ created_at: range }),
    status: { assigned: { user_companies: { some: {} } }, unassigned: { user_companies: { none: {} } } },
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

/** Find a company by ID with its membership count, returning null when it does not exist. */
export async function list_by_id_company(
  id: string,
  client: DatabaseExecutor = getDatabase(),
  access?: RecordAccess,
  action = "view",
) {
  const company = await client.company.findFirst({
    where: { AND: [{ id }, record_where(access, "companies", action)] },
    include: company_include,
  });
  return company ? serialize_company(company) : null;
}

/** Insert a company and optionally a default warehouse location in one transaction. */
export async function create_company(
  input: CreateCompanyInput,
  createdBy?: string,
): Promise<CreateCompanyResult> {
  const location_name = input.location_name?.trim();
  const location_address = input.location_address?.trim() ?? "";
  return getDatabase().$transaction(async (tx) => {
    const company = await tx.company.create({
      data: { name: input.name, created_by: createdBy },
      include: company_include,
    });
    if (!location_name) {
      return { company: serialize_company(company), location: null };
    }
    const location = await tx.location.create({
      data: {
        company_id: company.id,
        name: location_name,
        address: location_address,
        type: "warehouse",
        created_by: createdBy,
      },
      select: { id: true, name: true, type: true, address: true },
    });
    const with_location = await tx.company.findFirstOrThrow({
      where: { id: company.id },
      include: company_include,
    });
    return {
      company: serialize_company(with_location),
      location: serialize_location(location),
    };
  });
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

export async function get_company_filter_data(access?: RecordAccess) {
  return getDatabase().company.findMany({
    where: record_where(access, "companies"),
    select: { name: true, _count: { select: { user_companies: true } } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export async function list_company_members(id: string, pagination: Pagination, access?: RecordAccess) {
  return getDatabase().$transaction(async (tx) => {
    const company = await list_by_id_company(id, tx, access);
    if (!company) return null;
    const where = { company_id: id, user: record_where(access, "users") } satisfies Prisma.user_companyWhereInput;
    const memberships = await tx.user_company.findMany({
      where,
      select: {
        assigned_at: true,
        user: { select: { id: true, name: true, email: true } },
        roles: { select: { role: { select: { id: true, name: true } } }, orderBy: { role: { name: "asc" } } },
      },
      orderBy: [{ user: { name: "asc" } }, { id: "asc" }],
      skip: pagination.skip,
      take: pagination.take,
    });
    const total = await tx.user_company.count({ where });
    return {
      members: memberships.map(({ user, roles, assigned_at }) => ({
        ...user,
        assigned_at: assigned_at.toISOString(),
        roles: roles.map(({ role }) => role),
      })),
      ...paginationMetadata(total, pagination),
    };
  }, { isolationLevel: "RepeatableRead" });
}
