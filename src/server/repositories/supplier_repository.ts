import { Prisma } from "@/generated/prisma/client";
import type { QuickFilterState } from "@/types/quick-filter";
import { record_where, type RecordAccess } from "@/server/auth/record-access";
import { getDatabase, type DatabaseExecutor } from "@/server/lib/database";
import { build_filter } from "@/server/lib/filter";
import { paginationMetadata, type Pagination } from "@/server/lib/pagination";
import { build_sort, type Sorting } from "@/server/lib/sorting";
import type {
  CreateSupplierInput,
  ListSupplierResponse,
  UpdateSupplierInput,
} from "@/server/schema/supplier_schema";

const company = { company: { select: { id: true, name: true } } } satisfies Prisma.supplierInclude;

type SupplierRow = Prisma.supplierGetPayload<{ include: typeof company }>;

function present(record: SupplierRow, createdByName: string | null): ListSupplierResponse {
  return {
    ...record,
    created_by_name: createdByName,
    created_at: record.created_at.toISOString(),
    updated_at: record.updated_at.toISOString(),
  };
}

async function present_all(records: SupplierRow[], client: DatabaseExecutor) {
  const ids = [...new Set(records.flatMap((record) => record.created_by ? [record.created_by] : []))];
  const creators = ids.length
    ? await client.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    : [];
  const names = new Map(creators.map((creator) => [creator.id, creator.name]));
  return records.map((record) => present(record, record.created_by ? names.get(record.created_by) ?? null : null));
}

const supplierSort = {
  fields: {
    id: (direction: Prisma.SortOrder) => ({ id: direction }),
    name: (direction: Prisma.SortOrder) => ({ name: direction }),
    created_at: (direction: Prisma.SortOrder) => ({ created_at: direction }),
    updated_at: (direction: Prisma.SortOrder) => ({ updated_at: direction }),
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
    const rows = await tx.supplier.findMany({ where, include: company, orderBy, skip: pagination.skip, take: pagination.take });
    const suppliers = await present_all(rows, tx);
      return { suppliers, ...paginationMetadata(await tx.supplier.count({ where }), pagination) };
    }, { isolationLevel: "RepeatableRead" });
}

export async function list_by_id_supplier(
  id: string,
  access: RecordAccess,
){
  const client = getDatabase();
  const record = await client.supplier.findFirst({
    where: {AND: [{id}, record_where(access, "suppliers")]},
    include: company,
  });
  return record ? (await present_all([record], client))[0] : null;
}

export function get_supplier_filter_data(access: RecordAccess) {
  return getDatabase().supplier.findMany({
    where: record_where(access, "suppliers"),
    select: { name: true, company_id: true, company: { select: { id: true, name: true } } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export async function create_supplier(input: CreateSupplierInput, actor: string){
  const client = getDatabase();
  const record = await client.supplier.create({
    data: {
      name: input.name,
      contact_person: input.contact_person,
      contact_email: input.contact_email,
      contact_phone: input.contact_phone ?? "",
      contact_address: input.contact_address ?? "",
      created_by: actor,
      ...(input.company_id ? { company_id: input.company_id } : {}),
    },
    include: company,
  });
  return (await present_all([record], client))[0];
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
      },
      include: company,
    });
    return (await present_all([record], tx))[0];
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