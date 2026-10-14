import type { Prisma } from "@/generated/prisma/client";
import type { QuickFilterState } from "@/types/quick-filter";
import { record_where, type RecordAccess } from "@/server/auth/record-access";
import { getDatabase, type DatabaseExecutor } from "@/server/lib/database";
import { BrandError } from "@/server/lib/brands-input";
import { build_filter } from "@/server/lib/filter";
import { paginationMetadata, type Pagination } from "@/server/lib/pagination";
import { build_sort, type Sorting } from "@/server/lib/sorting";
import type { BrandSummary, CreateBrandInput, UpdateBrandInput } from "@/server/schema/brands_schema";

const brandInclude = {
  company: { select: { id: true, name: true } },
  _count: { select: { variants: true } },
} satisfies Prisma.brandInclude;
type BrandRecord = Prisma.brandGetPayload<{ include: typeof brandInclude }>;

async function creator_names(ids: Array<string | null>, client: DatabaseExecutor) {
  const unique = [...new Set(ids.flatMap((id) => id ? [id] : []))];
  const creators = unique.length
    ? await client.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } })
    : [];
  return new Map(creators.map((creator) => [creator.id, creator.name]));
}
function serialize_brand(record: BrandRecord, createdByName: string | null): BrandSummary {
  const { _count, ...brand } = record;
  return {
    ...brand,
    created_by_name: createdByName,
    variant_count: _count.variants,
    created_at: record.created_at.toISOString(),
    updated_at: record.updated_at.toISOString(),
  };
}

const nameSort = {
  fields: {
    id: (direction: Prisma.SortOrder) => ({ id: direction }),
    name: (direction: Prisma.SortOrder) => ({ name: direction }),
    created_at: (direction: Prisma.SortOrder) => ({ created_at: direction }),
    updated_at: (direction: Prisma.SortOrder) => ({ updated_at: direction }),
  },
  default: { field: "created_at" as const, direction: "desc" as const },
  tieBreaker: { field: "id" as const, order: { id: "asc" as const } },
};

export async function list_brands(pagination: Pagination, search: string, sorting: Sorting | undefined, access: RecordAccess, companyId?: string, filters?: QuickFilterState) {
  const where = build_filter<Prisma.brandWhereInput>(filters, {
    where: { AND: [record_where(access, "brandsAndVariants"), ...(companyId ? [{ company_id: companyId }] : [])] },
    fields: {
      name: (values) => ({ OR: values.map((name) => ({ name: { equals: name, mode: "insensitive" as const } })) }),
      company: (values) => ({ company_id: { in: values } }),
    },
    date: (range) => ({ created_at: range }),
    status: { with_variants: { variants: { some: {} } }, without_variants: { variants: { none: {} } } },
    search: { value: search, fields: [(filter) => ({ name: filter })] },
  });
  const orderBy = build_sort<Prisma.brandOrderByWithRelationInput>(sorting, nameSort);
  return getDatabase().$transaction(async (tx) => {
    const rows = await tx.brand.findMany({ where, include: brandInclude, orderBy, skip: pagination.skip, take: pagination.take });
    const names = await creator_names(rows.map((row) => row.created_by), tx);
    return {
      brands: rows.map((row) => serialize_brand(row, row.created_by ? names.get(row.created_by) ?? null : null)),
      ...paginationMetadata(await tx.brand.count({ where }), pagination),
    };
  }, { isolationLevel: "RepeatableRead" });
}
export function get_brand_filter_data(access: RecordAccess) {
  return getDatabase().brand.findMany({
    where: record_where(access, "brandsAndVariants"),
    select: { name: true, company: { select: { id: true, name: true } }, _count: { select: { variants: true } } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}
export async function get_brand(id: string, access: RecordAccess) {
  const client = getDatabase();
  const record = await client.brand.findFirst({ where: { AND: [{ id }, record_where(access, "brandsAndVariants")] }, include: brandInclude });
  if (!record) return null;
  const names = await creator_names([record.created_by], client);
  return serialize_brand(record, record.created_by ? names.get(record.created_by) ?? null : null);
}
export async function create_brand(input: CreateBrandInput, actor: string) {
  const client = getDatabase();
  const record = await client.brand.create({ data: { ...input, created_by: actor }, include: brandInclude });
  const names = await creator_names([record.created_by], client);
  return serialize_brand(record, names.get(actor) ?? null);
}
export async function update_brand(input: UpdateBrandInput, access: RecordAccess) {
  return getDatabase().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "brand" WHERE id = ${input.id}::uuid FOR UPDATE`;
    const current = await tx.brand.findFirst({
      where: { AND: [{ id: input.id }, record_where(access, "brandsAndVariants", "edit")] },
      include: brandInclude,
    });
    if (!current) throw new BrandError("not_found", "Brand not found.");
    const record = await tx.brand.update({ where: { id: input.id }, data: { name: input.name }, include: brandInclude });
    const names = await creator_names([record.created_by], tx);
    return serialize_brand(record, record.created_by ? names.get(record.created_by) ?? null : null);
  });
}
export async function delete_brand(id: string, access: RecordAccess) {
  await getDatabase().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "brand" WHERE id = ${id}::uuid FOR UPDATE`;
    const current = await tx.brand.findFirst({
      where: { AND: [{ id }, record_where(access, "brandsAndVariants", "delete")] },
      include: brandInclude,
    });
    if (!current) throw new BrandError("not_found", "Brand not found.");
    if (current._count.variants) throw new BrandError("conflict", "Delete this brand's variants first.");
    await tx.brand.delete({ where: { id } });
  });
}
