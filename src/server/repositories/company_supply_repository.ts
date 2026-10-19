import type { Prisma } from "@/generated/prisma/client";
import { getDatabase, type DatabaseExecutor } from "@/server/lib/database";
import { build_filter } from "@/server/lib/filter";
import { paginationMetadata, type Pagination } from "@/server/lib/pagination";
import type { CompanySupplyRecord, CreateCompanySupplyInput, SupplyDirection, SupplyStatus, UpdateCompanySupplyInput } from "@/server/schema/company_supply_schema";

const supplyInclude = {
  requesting_company: { select: { id: true, name: true } },
  supplying_company: { select: { id: true, name: true } },
} satisfies Prisma.company_supply_relationshipInclude;
type SupplyRecord = Prisma.company_supply_relationshipGetPayload<{ include: typeof supplyInclude }>;

async function serialize_company_supply(rows: SupplyRecord[], client: DatabaseExecutor): Promise<CompanySupplyRecord[]> {
  const users = await client.user.findMany({ where: { id: { in: [...new Set(rows.map((row) => row.created_by))] } }, select: { id: true, name: true } });
  const names = new Map(users.map((user) => [user.id, user.name]));
  return rows.map((row) => ({
    ...row, created_by_name: names.get(row.created_by) ?? null,
    created_at: row.created_at.toISOString(), updated_at: row.updated_at.toISOString(),
  }));
}

export function get_supply_company(id: string, client: DatabaseExecutor = getDatabase()) {
  return client.company.findUnique({ where: { id }, select: { id: true, name: true } });
}

export async function list_company_supply(companyId: string, direction: SupplyDirection, status: SupplyStatus, search: string, pagination: Pagination, client: DatabaseExecutor) {
  const where = build_filter<Prisma.company_supply_relationshipWhereInput>(undefined, {
    where: {
      ...(direction === "requesting" ? { requesting_company_id: companyId } : { supplying_company_id: companyId }),
      ...(status === "all" ? {} : { is_active: status === "active" }),
    },
    fields: {},
    search: { value: search, fields: [
      (filter) => direction === "requesting" ? { supplying_company: { name: filter } } : { requesting_company: { name: filter } },
    ] },
  });
  const rows = await client.company_supply_relationship.findMany({
    where, include: supplyInclude, orderBy: [{ created_at: "desc" }, { id: "asc" }],
    skip: pagination.skip, take: pagination.take,
  });
  return { relationships: await serialize_company_supply(rows, client), ...paginationMetadata(await client.company_supply_relationship.count({ where }), pagination) };
}

export async function get_company_supply_option(companyId: string, direction: SupplyDirection, search: string, pagination: Pagination, client: DatabaseExecutor) {
  const where = build_filter<Prisma.companyWhereInput>(undefined, {
    where: {
      id: { not: companyId },
      ...(direction === "requesting"
        ? { supply_relationships_as_supplier: { none: { requesting_company_id: companyId } } }
        : { supply_relationships_as_requester: { none: { supplying_company_id: companyId } } }),
    },
    fields: {}, search: { value: search, fields: [(filter) => ({ name: filter })] },
  });
  const companies = await client.company.findMany({
    where, select: { id: true, name: true }, orderBy: [{ name: "asc" }, { id: "asc" }],
    skip: pagination.skip, take: pagination.take,
  });
  return { companies, ...paginationMetadata(await client.company.count({ where }), pagination) };
}

export async function create_company_supply(input: CreateCompanySupplyInput, actor: string, client: DatabaseExecutor = getDatabase()) {
  const row = await client.company_supply_relationship.create({
    data: { requesting_company_id: input.requesting_company_id, supplying_company_id: input.supplying_company_id, created_by: actor },
    include: supplyInclude,
  });
  return (await serialize_company_supply([row], client))[0];
}

export async function update_company_supply(input: UpdateCompanySupplyInput, client: DatabaseExecutor) {
  const changed = await client.company_supply_relationship.updateMany({ where: { id: input.id }, data: { is_active: input.is_active } });
  if (!changed.count) return null;
  const row = await client.company_supply_relationship.findUniqueOrThrow({ where: { id: input.id }, include: supplyInclude });
  return (await serialize_company_supply([row], client))[0];
}
