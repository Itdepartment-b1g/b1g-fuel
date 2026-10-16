import { Prisma } from "@/generated/prisma/client";
import type { QuickFilterState } from "@/types/quick-filter";
import { record_where, type RecordAccess } from "@/server/auth/record-access";
import { getDatabase, type DatabaseExecutor } from "@/server/lib/database";
import { build_filter } from "@/server/lib/filter";
import { paginationMetadata, type Pagination } from "@/server/lib/pagination";
import { build_sort, type Sorting } from "@/server/lib/sorting";
import type {
  CreateProductInput,
  ListProductResponse,
  UpdateProductInput,
} from "@/server/schema/product_schema";

const include = {
  company: { select: { id: true, name: true } },
  variant: {
    select: {
      id: true,
      name: true,
      brand: { select: { id: true, name: true } },
    },
  },
  base_unit: { select: { id: true, name: true, symbol: true, key: true } },
  product_type: { select: { id: true, name: true, key: true } },
} satisfies Prisma.productInclude;

type Row = Prisma.productGetPayload<{ include: typeof include }>;

function display_name(record: Row) {
  return `${record.variant.brand.name} ${record.variant.name} · ${record.product_type.name}`;
}

function present(record: Row, createdByName: string | null): ListProductResponse {
  return {
    id: record.id,
    company_id: record.company_id,
    company: record.company,
    variant_id: record.variant_id,
    variant: record.variant,
    base_unit_id: record.base_unit_id,
    base_unit: record.base_unit,
    product_type_id: record.product_type_id,
    product_type: record.product_type,
    display_name: display_name(record),
    note: record.note,
    created_by: record.created_by,
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
    created_at: (direction: Prisma.SortOrder) => ({ created_at: direction }),
    updated_at: (direction: Prisma.SortOrder) => ({ updated_at: direction }),
  },
  default: { field: "created_at" as const, direction: "desc" as const },
  tieBreaker: { field: "id" as const, order: { id: "asc" as const } },
};

export async function list_products(
  pagination: Pagination,
  search: string,
  sorting: Sorting | undefined,
  access: RecordAccess,
  companyId?: string,
  filters?: QuickFilterState,
) {
  const where = build_filter<Prisma.productWhereInput>(filters, {
    where: {
      AND: [
        record_where(access, "products"),
        ...(companyId ? [{ company_id: companyId }] : []),
      ],
    },
    fields: {
      company: (values) => ({ company_id: { in: values } }),
      product_type: (values) => ({ product_type_id: { in: values } }),
    },
    date: (range) => ({ created_at: range }),
    search: {
      value: search,
      fields: [
        (filter) => ({ note: filter }),
        (filter) => ({ variant: { name: filter } }),
        (filter) => ({ variant: { brand: { name: filter } } }),
        (filter) => ({ product_type: { name: filter } }),
      ],
    },
  });
  const orderBy = build_sort<Prisma.productOrderByWithRelationInput>(
    sorting,
    sortConfig,
  );
  return getDatabase().$transaction(
    async (tx) => {
      const rows = await tx.product.findMany({
        where,
        include,
        orderBy,
        skip: pagination.skip,
        take: pagination.take,
      });
      return {
        products: await present_all(rows, tx),
        ...paginationMetadata(await tx.product.count({ where }), pagination),
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}

export async function list_by_id_product(id: string, access: RecordAccess) {
  const client = getDatabase();
  const record = await client.product.findFirst({
    where: { AND: [{ id }, record_where(access, "products")] },
    include,
  });
  return record ? (await present_all([record], client))[0] : null;
}

export function get_product_filter_data(access: RecordAccess) {
  return getDatabase().product.findMany({
    where: record_where(access, "products"),
    select: {
      company_id: true,
      company: { select: { id: true, name: true } },
      product_type: { select: { id: true, name: true } },
    },
    orderBy: [{ created_at: "desc" }, { id: "asc" }],
  });
}

export async function create_product(input: CreateProductInput, actor: string) {
  const client = getDatabase();
  const record = await client.product.create({
    data: {
      company_id: input.company_id,
      variant_id: input.variant_id,
      base_unit_id: input.base_unit_id,
      product_type_id: input.product_type_id,
      note: input.note ?? "",
      created_by: actor,
    },
    include,
  });
  return (await present_all([record], client))[0];
}

export async function update_product(
  input: UpdateProductInput,
  access: RecordAccess,
) {
  return getDatabase().$transaction(async (tx) => {
    const current = await tx.product.findFirst({
      where: {
        AND: [{ id: input.id }, record_where(access, "products", "edit")],
      },
    });
    if (!current) return null;
    const record = await tx.product.update({
      where: { id: input.id },
      data: {
        ...(input.variant_id !== undefined
          ? { variant_id: input.variant_id }
          : {}),
        ...(input.base_unit_id !== undefined
          ? { base_unit_id: input.base_unit_id }
          : {}),
        ...(input.product_type_id !== undefined
          ? { product_type_id: input.product_type_id }
          : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
      },
      include,
    });
    return (await present_all([record], tx))[0];
  });
}

export async function delete_product(id: string, access: RecordAccess) {
  return getDatabase().$transaction(async (tx) => {
    const current = await tx.product.findFirst({
      where: {
        AND: [{ id }, record_where(access, "products", "delete")],
      },
      select: { id: true },
    });
    if (!current) return "not_found" as const;
    await tx.product.delete({ where: { id } });
    return "deleted" as const;
  });
}
