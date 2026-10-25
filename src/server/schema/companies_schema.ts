export const COMPANY_SORT_FIELDS = [
  "id",
  "name",
  "created_at",
  "updated_at",
] as const;

export interface CompanySummary {
  code?: string | null;
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  member_count: number;
  facility_count: number;
  /** True when the company has at least one warehouse facility. */
  is_warehouse: boolean;
  /** Name of the first warehouse facility, when any. */
  warehouse_name: string | null;
  /** Address of the first warehouse facility, when any. */
  warehouse_address: string | null;
}

export type FacilityType = "warehouse" | "hub";

export interface CompanyFacilitySummary {
  id: string;
  name: string;
  type: FacilityType;
  address: string;
}

export interface CreateCompanyInput {
  code?: string;
  name: string;
  /** Optional default warehouse name. When set, a facility row is created. */
  facility_name?: string;
  /** Optional warehouse address; used only when facility_name is set. */
  facility_address?: string;
}

export interface UpdateCompanyInput {
  code?: string;
  id: string;
  name: string;
}

export interface CreateCompanyResult {
  company: CompanySummary;
  facility: CompanyFacilitySummary | null;
}
