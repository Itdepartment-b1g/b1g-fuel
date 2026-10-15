import { Prisma } from "@/generated/prisma/client";
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

export async function list_by_id_supplier(
  id: string,
  access: RecordAccess,
){
  const record = await getDatabase().supplier.findFirst({
    where: {AND: [{id}, record_where(access, "suppliers")]}
  });
  if(!record) return null;
  const supplier: ListSupplierResponse = {
    ...record,
    created_at: record.created_at.toISOString(),
    updated_at: record.updated_at.toISOString(),
  };
  return supplier;
}

export async function create_supplier(input: CreateSupplierInput, actor: string){
  const record = await getDatabase().supplier.create({
    data: {
      name: input.name,
      contact_person: input.contact_person,
      contact_email: input.contact_email,
      contact_phone: input.contact_phone,
      contact_address: input.contact_address,
      created_by: actor,
      ...(input.company_id ? { company_id: input.company_id } : {}),
    }
  })
  const supplier: ListSupplierResponse = {
    ...record, 
    created_at: record.created_at.toISOString(),
    updated_at: record.updated_at.toISOString(),
  }
  return supplier;
}

export async function update_supplier(
  input: UpdateSupplierInput,
  access: RecordAccess,
){
  return getDatabase().$transaction(async (tx) => {
    const current = await tx.supplier.findFirst({
      where: {AND: [{id: input.id}, record_where(access, "suppliers", "edit")]}
    });
    if(!current) return null;
    const record = await tx.supplier.update({
      where: {id: input.id},
      data: {
        ...(input.name !== undefined ? {name: input.name}: {}),
        ...(input.contact_person !== undefined ? {contact_person: input.contact_person}: {}),
        ...(input.contact_email !== undefined ? {contact_email: input.contact_email}: {}),
        ...(input.contact_phone !== undefined ? {contact_phone: input.contact_phone}: {}),
        ...(input.contact_address !== undefined ? {contact_address: input.contact_address}: {}),
      }
    });
    return {
      ...record,
      created_at: record.created_at.toISOString(),
      updated_at: record.updated_at.toISOString(),
    };
  })

}

export async function delete_supplier(
  id: string,
  access: RecordAccess,
){
return getDatabase().$transaction(async (tx) => {
  const current = await tx.supplier.findFirst({
    where: {AND: [{id}, record_where(access, "suppliers", "delete")]},
    select: {id: true},
  });
  if(!current) return "not_found" as const;
  await tx.supplier.delete({ where: {id} })
  return "deleted" as const;
})
}