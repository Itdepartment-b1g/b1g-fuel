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
  location_count: number;
}

export type LocationType = "warehouse" | "hub";

export interface CompanyLocationSummary {
  id: string;
  name: string;
  type: LocationType;
  address: string;
}

export interface CreateCompanyInput {
  name: string;
  /** Optional default warehouse name. When set, a location row is created. */
  location_name?: string;
  /** Optional warehouse address; used only when location_name is set. */
  location_address?: string;
}

export interface UpdateCompanyInput {
  id: string;
  name: string;
}

export interface CreateCompanyResult {
  company: CompanySummary;
  location: CompanyLocationSummary | null;
}
