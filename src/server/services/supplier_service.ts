import type { QuickFilterState } from "@/types/quick-filter";
import type { RecordAccess } from "@/server/auth/record-access";
import { getDatabase } from "@/server/lib/database";
import type { Pagination } from "@/server/lib/pagination";
import type { Sorting } from "@/server/lib/sorting";
import type { CreateSupplierInput, UpdateSupplierInput } from "@/server/schema/supplier_schema";
import * as repository from "@/server/repositories/supplier_repository";

export class SupplierError extends Error {
    constructor(
      public code: "invalid_input" | "not_found" | "forbidden" | "conflict",
      message: string,
    ) {
      super(message);
    }
  }

  
export function list_suppliers(
    pagination: Pagination,
    search: string,
    sorting: Sorting | undefined,
    access: RecordAccess,
    companyId?: string,
    filters?: QuickFilterState,
  ) {
    return repository.list_suppliers(pagination, search, sorting, access, companyId, filters);
  }
  
  export async function list_by_id_supplier(id: string, access: RecordAccess) {
    const supplier = await repository.list_by_id_supplier(id, access);
    if (!supplier) throw new SupplierError("not_found", "Supplier not found.");
    return supplier;
  }
  
  export function create_supplier(input: CreateSupplierInput, access: RecordAccess) {
    return repository.create_supplier(input, access.userId);
  }
  
  export async function update_supplier(input: UpdateSupplierInput, access: RecordAccess) {
    const supplier = await repository.update_supplier(input, access);
    if (!supplier) throw new SupplierError("not_found", "Supplier not found.");
    return supplier;
  }
  
  export async function delete_supplier(id: string, access: RecordAccess) {
    const result = await repository.delete_supplier(id, access);
    if (result === "not_found") throw new SupplierError("not_found", "Supplier not found.");
  }