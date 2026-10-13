import type { QuickFilterState } from "@/lib/quick-filter";
import { COMPANY_FILTER_OPTIONS } from "@/lib/management-filters";
import { build_filter_options } from "@/server/lib/quick-filters";
import type { RecordAccess } from "@/server/auth/record-access";
import type { Sorting } from "@/server/lib/sorting";
import type { CreateCompanyInput, UpdateCompanyInput } from "@/server/schema/companies_schema";
import * as companiesRepository from "@/server/repositories/companies_repository";
import { getDatabase } from "@/server/lib/database";
import type { Pagination } from "@/server/lib/pagination";

export async function create_company(
  input: CreateCompanyInput,
  repository = companiesRepository,
  createdBy?: string,
) {
  return repository.create_company(input, createdBy);
}

export async function list_company(
  pagination: Pagination,
  search: string,
  sorting?: Sorting,
  repository = companiesRepository,
  access?: RecordAccess,
  filters?: QuickFilterState,
) {
  return repository.list_company(pagination, search, sorting, access, filters);
}

export async function list_by_id_company(id: string, repository = companiesRepository, access?: RecordAccess) {
  const company = await repository.list_by_id_company(id, undefined, false, access);
  if (!company) throw new CompanyError("company_not_found", "Company not found.");
  return company;
}

export async function update_company(
  input: UpdateCompanyInput,
  repository = companiesRepository,
  access?: RecordAccess,
) {
  return getDatabase().$transaction(async (transaction) => {
    if (!await repository.list_by_id_company(input.id, transaction, true, access, "edit"))
      throw new CompanyError("company_not_found", "Company not found.");
    return repository.update_company(input, transaction, access);
  });
}

export async function delete_company(id: string, repository = companiesRepository, access?: RecordAccess) {
  return getDatabase().$transaction(async (transaction) => {
    const company = await repository.list_by_id_company(id, transaction, true, access, "delete");
    if (!company) throw new CompanyError("company_not_found", "Company not found.");
    if (company.member_count > 0)
      throw new CompanyError(
        "company_has_members",
        "This company has members. Remove or reassign its memberships before deleting it.",
      );
    await repository.delete_company(id, transaction, access);
    return { id, message: "Company deleted." };
  });
}

export type CompanyErrorCode = "invalid_input" | "company_not_found" | "company_has_members";

export class CompanyError extends Error {
  constructor(public code: CompanyErrorCode, message: string) { super(message); }
}

export async function get_company_filter_option(repository = companiesRepository, access?: RecordAccess) {
  const records = await repository.get_company_filter_data(access);
  return build_filter_options(records, COMPANY_FILTER_OPTIONS,
    (company) => ({ value: company.name, label: company.name }),
    (company, status) => (company._count.user_companies > 0) === (status === "assigned"),
  );
}
