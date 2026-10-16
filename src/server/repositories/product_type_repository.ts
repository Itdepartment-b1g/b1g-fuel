import { Prisma } from "@/generated/prisma/client";
import type { QuickFilterState } from "@/types/quick-filter";
import { record_where, type RecordAccess } from "@/server/auth/record-access";
import { getDatabase, type DatabaseExecutor } from "@/server/lib/database";
import { build_filter } from "@/server/lib/filter";
import { paginationMetadata, type Pagination } from "@/server/lib/pagination";
import { build_sort, type Sorting } from "@/server/lib/sorting";
import type {
  CreateProductTypeInput,
  ListProductTypeResponse,
  UpdateProductTypeInput,
} from "@/server/schema/product_type_schema";

const company = {
  company: { select: { id: true, name: true } },
} satisfies Prisma.product_typeInclude;

type Row = Prisma.product_typeGetPayload<{ include: typeof company }>;

function present(record: Row, createdByName: string | null): ListProductTypeResponse {
  return {
    ...record,
    created_by_name: createdByName,
    created_at: record.created_at.toISOString(),
    updated_at: record.updated_at.toISOString(),
  };
}

async function present_all(records: Row[], client: DatabaseExecutor) {
  const ids = [
    ...new Set(
      records.flatMap((record) => (record.created_by ? [record.created_by] : [])),
    ),
  ];
  const creators = ids.length
    ? await client.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      })
    : [];
  const names = new Map(creators.map((creator) => [creator.id, creator.name]));
  return records.map((record) =>
    present(
      record,
      record.created_by ? (names.get(record.created_by) ?? null) : null,
    ),
  );
}

const sortConfig = {
  fields: {
    id: (direction: Prisma.SortOrder) => ({ id: direction }),
    name: (direction: Prisma.SortOrder) => ({ name: direction }),
    key: (direction: Prisma.SortOrder) => ({ key: direction }),
    created_at: (direction: Prisma.SortOrder) => ({ created_at: direction }),
    updated_at: (direction: Prisma.SortOrder) => ({ updated_at: direction }),
  },
  default: { field: "created_at" as const, direction: "desc" as const },
  tieBreaker: { field: "id" as const, order: { id: "asc" as const } },
};

export async function list_product_types(
  pagination: Pagination,
  search: string,
  sorting: Sorting | undefined,
  access: RecordAccess,
  companyId?: string,
  filters?: QuickFilterState,
) {
  const where = build_filter<Prisma.product_typeWhereInput>(filters, {
    where: {
      AND: [
        record_where(access, "productTypes"),
        ...(companyId ? [{ company_id: companyId }] : []),
      ],
    },
    fields: {
      name: (values) => ({
        OR: values.map((name) => ({
          name: { equals: name, mode: "insensitive" as const },
        })),
      }),
      company: (values) => ({ company_id: { in: values } }),
    },
    date: (range) => ({ created_at: range }),
    status: {
      shared: { company_id: null },
      company: { company_id: { not: null } },
    },
    search: {
      value: search,
      fields: [(filter) => ({ name: filter }), (filter) => ({ key: filter })],
    },
  });
  const orderBy = build_sort<Prisma.product_typeOrderByWithRelationInput>(
    sorting,
    sortConfig,
  );
  return getDatabase().$transaction(
    async (tx) => {
      const rows = await tx.product_type.findMany({
        where,
        include: company,
        orderBy,
        skip: pagination.skip,
        take: pagination.take,
      });
      return {
        product_types: await present_all(rows, tx),
        ...paginationMetadata(await tx.product_type.count({ where }), pagination),
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}

export async function list_by_id_product_type(id: string, access: RecordAccess) {
  const client = getDatabase();
  const record = await client.product_type.findFirst({
    where: { AND: [{ id }, record_where(access, "productTypes")] },
    include: company,
  });
  return record ? (await present_all([record], client))[0] : null;
}

export function get_product_type_filter_data(access: RecordAccess) {
  return getDatabase().product_type.findMany({
    where: record_where(access, "productTypes"),
    select: {
      name: true,
      company_id: true,
      company: { select: { id: true, name: true } },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export async function create_product_type(
  input: CreateProductTypeInput,
  actor: string,
) {
  const client = getDatabase();
  const record = await client.product_type.create({
    data: {
      name: input.name,
      key: input.key,
      created_by: actor,
      ...(input.company_id ? { company_id: input.company_id } : {}),
    },
    include: company,
  });
  return (await present_all([record], client))[0];
}

export async function update_product_type(
  input: UpdateProductTypeInput,
  access: RecordAccess,
) {
  return getDatabase().$transaction(async (tx) => {
    const current = await tx.product_type.findFirst({
      where: {
        AND: [{ id: input.id }, record_where(access, "productTypes", "edit")],
      },
    });
    if (!current) return null;
    const record = await tx.product_type.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.key !== undefined ? { key: input.key } : {}),
      },
      include: company,
    });
    return (await present_all([record], tx))[0];
  });
}

export async function delete_product_type(id: string, access: RecordAccess) {
  return getDatabase().$transaction(async (tx) => {
    const current = await tx.product_type.findFirst({
      where: {
        AND: [{ id }, record_where(access, "productTypes", "delete")],
      },
      select: { id: true },
    });
    if (!current) return "not_found" as const;
    await tx.product_type.delete({ where: { id } });
    return "deleted" as const;
  });
}
