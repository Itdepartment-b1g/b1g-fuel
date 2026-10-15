import type { QuickFilterState } from "@/types/quick-filter";
import type { RecordAccess } from "@/server/auth/record-access";
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
  
  function can_create(access: RecordAccess, companyId: string) {
    return access.superAdmin || access.grants.some((grant) => grant.permission === "suppliers.add" && (
      (grant.scope === "all" && !grant.companyId) || (grant.companyId ? grant.companyId === companyId : access.companyIds.includes(companyId))
    ));
  }

  function supplier_company(access: RecordAccess, requested?: string) {
    if (access.superAdmin) return null;
    const unrestricted = access.grants.some((grant) => grant.permission === "suppliers.add" && grant.scope === "all" && !grant.companyId);
    const granted = [...new Set(access.grants.filter((grant) => grant.permission === "suppliers.add").flatMap((grant) => grant.companyId ? [grant.companyId] : access.companyIds))];
    const choices = unrestricted ? access.companyIds : granted;
    if (choices.length === 1) {
      if (!can_create(access, choices[0])) throw new SupplierError("forbidden", "You cannot create suppliers in this company.");
      return choices[0];
    }
    if (!requested) throw new SupplierError("invalid_input", "Select a company.");
    if (!can_create(access, requested)) throw new SupplierError("forbidden", "You cannot create suppliers in this company.");
    return requested;
  }

  export async function create_supplier(input: CreateSupplierInput, access: RecordAccess) {
    const company_id = supplier_company(access, input.company_id);
    return repository.create_supplier({ ...input, company_id: company_id ?? undefined }, access.userId);
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