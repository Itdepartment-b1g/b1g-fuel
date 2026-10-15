import type { Prisma } from "@/generated/prisma/client";
import { record_where, type RecordAccess } from "@/server/auth/record-access";
import { getDatabase, type DatabaseExecutor } from "@/server/lib/database";
import { paginationMetadata, type Pagination } from "@/server/lib/pagination";
import { build_sort, type Sorting } from "@/server/lib/sorting";
import type {
  CreateVariantInput,
  UpdateVariantInput,
  VariantSummary,
} from "@/server/schema/variants_schema";

const variantInclude = {
  brand: { select: { id: true, name: true } },
  company: { select: { id: true, name: true } },
} satisfies Prisma.variantInclude;
type VariantRecord = Prisma.variantGetPayload<{
  include: typeof variantInclude;
}>;

function scope(
  access: RecordAccess,
  action?: string,
): Prisma.variantWhereInput {
  return record_where(
    access,
    "brandsAndVariants",
    action,
  ) as Prisma.variantWhereInput;
}
async function creator_names(
  ids: Array<string | null>,
  client: DatabaseExecutor,
) {
  const unique = [...new Set(ids.flatMap((id) => (id ? [id] : [])))];
  const creators = unique.length
    ? await client.user.findMany({
        where: { id: { in: unique } },
        select: { id: true, name: true },
      })
    : [];
  return new Map(creators.map((creator) => [creator.id, creator.name]));
}
function serialize_variant(
  record: VariantRecord,
  createdByName: string | null,
): VariantSummary {
  return {
    ...record,
    created_by_name: createdByName,
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

export async function list_variants(
  pagination: Pagination,
  search: string,
  sorting: Sorting | undefined,
  access: RecordAccess,
  brandId?: string,
  companyId?: string,
) {
  const where: Prisma.variantWhereInput = {
    AND: [
      scope(access),
      {
        ...(brandId ? { brand_id: brandId } : {}),
        ...(companyId ? { company_id: companyId } : {}),
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      },
    ],
  };
  const orderBy = build_sort<Prisma.variantOrderByWithRelationInput>(
    sorting,
    nameSort,
  );
  return getDatabase().$transaction(
    async (tx) => {
      const rows = await tx.variant.findMany({
        where,
        include: variantInclude,
        orderBy,
        skip: pagination.skip,
        take: pagination.take,
      });
      const names = await creator_names(
        rows.map((row) => row.created_by),
        tx,
      );
      return {
        variants: rows.map((row) =>
          serialize_variant(
            row,
            row.created_by ? (names.get(row.created_by) ?? null) : null,
          ),
        ),
        ...paginationMetadata(await tx.variant.count({ where }), pagination),
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
export async function get_variant(id: string, access: RecordAccess) {
  const client = getDatabase();
  const record = await client.variant.findFirst({
    where: { AND: [{ id }, scope(access)] },
    include: variantInclude,
  });
  if (!record) return null;
  const names = await creator_names([record.created_by], client);
  return serialize_variant(
    record,
    record.created_by ? (names.get(record.created_by) ?? null) : null,
  );
}
export async function create_variant(input: CreateVariantInput, actor: string) {
  const client = getDatabase();
  const record = await client.variant.create({
    data: { ...input, created_by: actor },
    include: variantInclude,
  });
  const names = await creator_names([record.created_by], client);
  return serialize_variant(record, names.get(actor) ?? null);
}
export async function update_variant(
  input: UpdateVariantInput,
  access: RecordAccess,
) {
  return getDatabase().$transaction(async (tx) => {
    const current = await tx.variant.findFirst({
      where: { AND: [{ id: input.id }, scope(access, "edit")] },
      include: variantInclude,
    });
    if (!current) return null;
    const record = await tx.variant.update({
      where: { id: input.id },
      data: { name: input.name },
      include: variantInclude,
    });
    const names = await creator_names([record.created_by], tx);
    return serialize_variant(
      record,
      record.created_by ? (names.get(record.created_by) ?? null) : null,
    );
  });
}
export async function delete_variant(id: string, access: RecordAccess) {
  return getDatabase().$transaction(async (tx) => {
    const current = await tx.variant.findFirst({
      where: { AND: [{ id }, scope(access, "delete")] },
      select: { id: true },
    });
    if (!current) return "not_found" as const;
    await tx.variant.delete({ where: { id } });
    return "deleted" as const;
  });
}
