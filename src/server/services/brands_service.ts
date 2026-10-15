import type { QuickFilterState } from "@/types/quick-filter";
import { BRAND_FILTER_OPTIONS } from "@/utils/management-filters";
import type { RecordAccess } from "@/server/auth/record-access";
import { getDatabase } from "@/server/lib/database";
import { build_filter_options } from "@/server/lib/quick-filters";
import type { Pagination } from "@/server/lib/pagination";
import type { Sorting } from "@/server/lib/sorting";
import type { CreateBrandInput, UpdateBrandInput } from "@/server/schema/brands_schema";
import * as repository from "@/server/repositories/brands_repository";

export class BrandError extends Error {
  constructor(public code: "invalid_input" | "not_found" | "forbidden" | "conflict", message: string) { super(message); }
}

function can_create(access: RecordAccess, companyId: string) {
  return access.superAdmin || access.grants.some((grant) => grant.permission === "brandsAndVariants.add" && (
    (grant.scope === "all" && !grant.companyId) || (grant.companyId ? grant.companyId === companyId : access.companyIds.includes(companyId))
  ));
}
function assigned_company(access: RecordAccess, requested: string | undefined) {
  if (access.superAdmin) return null;
  const unrestricted = access.grants.some((grant) => grant.permission === "brandsAndVariants.add" && grant.scope === "all" && !grant.companyId);
  const granted = [...new Set(access.grants.filter((grant) => grant.permission === "brandsAndVariants.add").flatMap((grant) => grant.companyId ? [grant.companyId] : access.companyIds))];
  const choices = unrestricted ? access.companyIds : granted;
  if (choices.length === 1) {
    if (!can_create(access, choices[0])) throw new BrandError("forbidden", "You cannot create brands in this company.");
    return choices[0];
  }
  if (!requested) throw new BrandError("invalid_input", "Select a company.");
  if (!can_create(access, requested)) throw new BrandError("forbidden", "You cannot create brands in this company.");
  return requested;
}
async function company_options(access: RecordAccess) {
  const all = access.superAdmin || access.grants.some((grant) => grant.permission === "brandsAndVariants.add" && grant.scope === "all" && !grant.companyId);
  const ids = [...new Set(access.grants.filter((grant) => grant.permission === "brandsAndVariants.add").flatMap((grant) => grant.companyId ? [grant.companyId] : access.companyIds))];
  return getDatabase().company.findMany({
    where: all ? {} : { id: { in: ids } },
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export function can_create_brand(access: RecordAccess, companyId: string) {
  return can_create(access, companyId);
}
export function brand_company(access: RecordAccess, requested?: string) {
  return assigned_company(access, requested);
}
export async function create_brand(input: CreateBrandInput, access: RecordAccess) {
  const company_id = brand_company(access, input.company_id ?? undefined);
  return repository.create_brand({ ...input, company_id }, access.userId);
}
export function list_brands(pagination: Pagination, search: string, sorting: Sorting | undefined, access: RecordAccess, companyId?: string, filters?: QuickFilterState) {
  return repository.list_brands(pagination, search, sorting, access, companyId, filters);
}
export async function get_brand_filter_options(access: RecordAccess) {
  const records = await repository.get_brand_filter_data(access);
  return build_filter_options(records, BRAND_FILTER_OPTIONS,
    (brand, field) => field === "company" ? (brand.company ? { value: brand.company.id, label: brand.company.name } : null) : { value: brand.name, label: brand.name },
    (brand, status) => status === "all" || (brand._count.variants > 0) === (status === "with_variants"),
  );
}
export async function get_brand(id: string, access: RecordAccess) {
  const result = await repository.get_brand(id, access);
  if (!result) throw new BrandError("not_found", "Brand not found.");
  return result;
}
export async function update_brand(input: UpdateBrandInput, access: RecordAccess) {
  const brand = await repository.update_brand(input, access);
  if (!brand) throw new BrandError("not_found", "Brand not found.");
  return brand;
}
export async function delete_brand(id: string, access: RecordAccess) {
  const result = await repository.delete_brand(id, access);
  if (result === "not_found") throw new BrandError("not_found", "Brand not found.");
  if (result === "conflict") throw new BrandError("conflict", "Delete this brand's variants first.");
}
export async function get_brand_options(access: RecordAccess) {
  return { companies: await company_options(access) };
}
