export const COMPANY_SORT_FIELDS = ["id","name","created_at","updated_at"] as const;

export type CompanySummary = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  member_count: number;
};
export type CompaniesPage = {
  companies: CompanySummary[];
  total: number;
  page: number;
  page_size: number;
};
export type CompanyResponse = { company: CompanySummary };
export type CreateCompanyInput = { name: string };
export type UpdateCompanyInput = { id: string; name: string };
export type DeleteCompanyResponse = { id: string; message: string };
