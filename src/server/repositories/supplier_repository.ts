import type { Prisma } from "@/generated/prisma/client";
import type { QuickFilterState } from "@/types/quick-filter";
import { record_where, type RecordAccess } from "@/server/auth/record-access";
import { getDatabase } from "@/server/lib/database";
import { build_filter } from "@/server/lib/filter";
import { paginationMetadata, type Pagination } from "@/server/lib/pagination";
import { build_sort, type Sorting } from "@/server/lib/sorting";
import type {
  CreateSupplierInput,
  ListSupplierResponse,
  UpdateSupplierInput,
} from "@/server/schema/supplier_schema";

const supplierSort = {
  fields: {
    id: (direction: Prisma.SortOrder) => ({ id: direction }),
    name: (direction: Prisma.SortOrder) => ({ name: direction }),
    created_at: (direction: Prisma.SortOrder) => ({ created_at: direction }),
    updated_at: (direction: Prisma.SortOrder) => ({ created_at: direction }),
  },
  default: { field: "created_at" as const, direction: "desc" as const },
  tieBreaker: { field: "id" as const, order: { id: "asc" as const } },
};

export async function list_suppliers(
  pagination: Pagination,
  search: string,
  sorting: Sorting | undefined,
  access: RecordAccess,
  companyId?: string,
  filters?: QuickFilterState,
) {
  const where = build_filter<Prisma.supplierWhereInput>(filters, {
    where: {
      AND: [
        record_where(access, "suppliers"),
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
      fields: [
        (filter) => ({ name: filter }),
        (filter) => ({ contact_person: filter }),
        (filter) => ({ contact_email: filter }),
        (filter) => ({ contact_phone: filter }),
        (filter) => ({ contact_address: filter }),
      ],
    },
  });

  const orderBy = build_sort<Prisma.supplierOrderByWithRelationInput>(sorting, supplierSort);
  return getDatabase().$transaction(async(tx) => {
    const rows = await tx.supplier.findMany({where, orderBy, skip: pagination.skip, take: pagination.take});
    const suppliers: ListSupplierResponse[] = rows.map((row) => ({
        ...row,
        created_at: row.created_at.toISOString(),
        updated_at: row.updated_at.toISOString(),
      }));
      return { suppliers, ...paginationMetadata(await tx.supplier.count({ where }), pagination) };
    }, { isolationLevel: "RepeatableRead" });
}

