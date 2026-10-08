import type { CreateCompanyInput, UpdateCompanyInput } from "@/server/schema/companies_schema";
import * as companiesRepository from "@/server/repositories/companies_repository";
import { getDatabase } from "@/server/utils/database";
import { CompanyError } from "@/server/utils/errors";
import type { Pagination } from "@/server/utils/pagination";

export function create_company_service(repository = companiesRepository) {
  return {
    list_company(pagination: Pagination, search: string) { return repository.list_company(pagination, search); },
    async edit_company(id: string) {
      const company = await repository.list_by_id_company(id);
      if (!company) throw new CompanyError("company_not_found", "Company not found.");
      return company;
    },
    create_company(input: CreateCompanyInput) { return repository.create_company(input); },
    update_company(input: UpdateCompanyInput) {
      return getDatabase().transaction(async transaction => {
        if (!await repository.list_by_id_company(input.id, transaction, true)) throw new CompanyError("company_not_found", "Company not found.");
        return repository.update_company(input, transaction);
      });
    },
    delete_company(id: string) {
      return getDatabase().transaction(async transaction => {
        const company = await repository.list_by_id_company(id, transaction, true);
        if (!company) throw new CompanyError("company_not_found", "Company not found.");
        if (company.member_count > 0) throw new CompanyError("company_has_members", "This company has members. Remove or reassign its memberships before deleting it.");
        await repository.delete_company(id, transaction);
        return { id, message: "Company deleted." };
      });
    },
  };
}
export const companyService = create_company_service();
