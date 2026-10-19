import type { RecordAccess } from "@/server/auth/record-access";
import { getDatabase } from "@/server/lib/database";
import type { Pagination } from "@/server/lib/pagination";
import type { CreateCompanySupplyInput, SupplyDirection, SupplyStatus, UpdateCompanySupplyInput } from "@/server/schema/company_supply_schema";
import * as repository from "@/server/repositories/company_supply_repository";

export class CompanySupplyError extends Error {
  constructor(public code: "invalid_input" | "not_found" | "forbidden" | "conflict", message: string) { super(message); }
}

function require_supply_admin(access: RecordAccess) {
  if (!access?.superAdmin) throw new CompanySupplyError("forbidden", "Only Super Admin can manage company supply links.");
}

export async function list_company_supply(companyId: string, direction: SupplyDirection, status: SupplyStatus, search: string, pagination: Pagination, access: RecordAccess) {
  require_supply_admin(access);
  return getDatabase().$transaction(async (tx) => {
    if (!await repository.get_supply_company(companyId, tx)) throw new CompanySupplyError("not_found", "Company not found.");
    return repository.list_company_supply(companyId, direction, status, search, pagination, tx);
  }, { isolationLevel: "RepeatableRead" });
}

export async function get_company_supply_option(companyId: string, direction: SupplyDirection, search: string, pagination: Pagination, access: RecordAccess) {
  require_supply_admin(access);
  return getDatabase().$transaction(async (tx) => {
    if (!await repository.get_supply_company(companyId, tx)) throw new CompanySupplyError("not_found", "Company not found.");
    return repository.get_company_supply_option(companyId, direction, search, pagination, tx);
  }, { isolationLevel: "RepeatableRead" });
}

export async function create_company_supply(input: CreateCompanySupplyInput, access: RecordAccess) {
  require_supply_admin(access);
  if (input.requesting_company_id === input.supplying_company_id)
    throw new CompanySupplyError("invalid_input", "Choose two different companies.");
  return repository.create_company_supply(input, access.userId);
}

export async function update_company_supply(input: UpdateCompanySupplyInput, access: RecordAccess) {
  require_supply_admin(access);
  return getDatabase().$transaction(async (tx) => {
    const relationship = await repository.update_company_supply(input, tx);
    if (!relationship) throw new CompanySupplyError("not_found", "Supply link not found.");
    return relationship;
  });
}
