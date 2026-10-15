export const COMPANY_SORT_FIELDS = [
  "id",
  "name",
  "created_at",
  "updated_at",
] as const;

export interface CompanySummary {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  member_count: number;
}

export interface CreateCompanyInput {
  name: string;
}

export interface UpdateCompanyInput extends CreateCompanyInput {
  id: string;
}
