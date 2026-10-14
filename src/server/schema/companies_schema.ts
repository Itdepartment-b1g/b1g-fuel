export const COMPANY_SORT_FIELDS = ["id","name","created_at","updated_at"] as const;

export type {
  CompanySummary,
  CompaniesPage,
  CompanyResponse,
  CompanyMember,
  CompanyMembersPage,
  CreateCompanyInput,
  UpdateCompanyInput,
  DeleteCompanyResponse,
} from "@/types/companies";
