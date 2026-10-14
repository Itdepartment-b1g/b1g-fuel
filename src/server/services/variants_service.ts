import type { RecordAccess } from "@/server/auth/record-access";
import { getDatabase } from "@/server/lib/database";
import { VariantError } from "@/server/lib/variants-input";
import type { Pagination } from "@/server/lib/pagination";
import type { Sorting } from "@/server/lib/sorting";
import type { CreateVariantInput, UpdateVariantInput } from "@/server/schema/variants_schema";
import * as repository from "@/server/repositories/variants_repository";

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
    if (!can_create(access, choices[0])) throw new VariantError("forbidden", "You cannot create variants in this company.");
    return choices[0];
  }
  if (!requested) throw new VariantError("invalid_input", "Select a company.");
  if (!can_create(access, requested)) throw new VariantError("forbidden", "You cannot create variants in this company.");
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

export function variant_company(access: RecordAccess, requested?: string) {
  return assigned_company(access, requested);
}
export async function create_variant(input: CreateVariantInput, access: RecordAccess) {
  const company_id = variant_company(access, input.company_id ?? undefined);
  const brand = await getDatabase().brand.findUnique({ where: { id: input.brand_id }, select: { company_id: true } });
  if (!brand) throw new VariantError("not_found", "Brand not found.");
  if (!access.superAdmin && brand.company_id !== null && brand.company_id !== company_id) {
    throw new VariantError("forbidden", "You cannot create variants for this brand.");
  }
  return repository.create_variant({ ...input, company_id }, access.userId);
}
export function list_variants(pagination: Pagination, search: string, sorting: Sorting | undefined, access: RecordAccess, brandId?: string, companyId?: string) {
  return repository.list_variants(pagination, search, sorting, access, brandId, companyId);
}
export async function get_variant(id: string, access: RecordAccess) {
  const result = await repository.get_variant(id, access);
  if (!result) throw new VariantError("not_found", "Variant not found.");
  return result;
}
export function update_variant(input: UpdateVariantInput, access: RecordAccess) {
  return repository.update_variant(input, access);
}
export function delete_variant(id: string, access: RecordAccess) {
  return repository.delete_variant(id, access);
}
export async function get_variant_options(access: RecordAccess) {
  const companies = await company_options(access);
  const brands = await getDatabase().brand.findMany({
    where: access.superAdmin ? {} : { OR: [{ company_id: { in: companies.map((company) => company.id) } }, { company_id: null }] },
    select: { id: true, name: true, company_id: true, company: { select: { id: true, name: true } } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  return { brands, companies };
}
