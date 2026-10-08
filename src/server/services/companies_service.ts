import type { CreateCompanyInput, UpdateCompanyInput } from "@/server/schema/companies_schema";
import * as companiesRepository from "@/server/repositories/companies_repository";
import { getDatabase } from "@/server/utils/database";
import { CompanyError } from "@/server/utils/errors";
import type { Pagination } from "@/server/utils/pagination";

export async function create_company(
  input: CreateCompanyInput,
  repository = companiesRepository,
) {
  return repository.create_company(input);
}

export async function list_company(
  pagination: Pagination,
  search: string,
  repository = companiesRepository,
) {
  return repository.list_company(pagination, search);
}

export async function edit_company(id: string, repository = companiesRepository) {
  const company = await repository.list_by_id_company(id);
  if (!company) throw new CompanyError("company_not_found", "Company not found.");
  return company;
}

export async function update_company(
  input: UpdateCompanyInput,
  repository = companiesRepository,
) {
  return getDatabase().transaction(async (transaction) => {
    if (!await repository.list_by_id_company(input.id, transaction, true))
      throw new CompanyError("company_not_found", "Company not found.");
    return repository.update_company(input, transaction);
  });
}

export async function delete_company(id: string, repository = companiesRepository) {
  return getDatabase().transaction(async (transaction) => {
    const company = await repository.list_by_id_company(id, transaction, true);
    if (!company) throw new CompanyError("company_not_found", "Company not found.");
    if (company.member_count > 0)
      throw new CompanyError(
        "company_has_members",
        "This company has members. Remove or reassign its memberships before deleting it.",
      );
    await repository.delete_company(id, transaction);
    return { id, message: "Company deleted." };
  });
}
