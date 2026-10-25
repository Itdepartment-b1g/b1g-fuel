export interface CompanyOption {
  // Unique identifier (UUID) of the company.
  id: string;
  // Display name of the company.
  name: string;
}

export interface Company extends CompanyOption {
  code?: string | null;
  // UUID of the user who created the company, when recorded.
  created_by: string | null;
  // ISO date string when the company was created.
  created_at: string;
  // ISO date string when the company was last updated.
  updated_at: string;
  // Number of users with a membership in this company.
  member_count: number;
  // Number of facilities (warehouses/hubs) under this company.
  facility_count: number;
  // True when the company has at least one warehouse facility.
  is_warehouse: boolean;
  // Name of the first warehouse facility, when any.
  warehouse_name: string | null;
  // Address of the first warehouse facility, when any.
  warehouse_address: string | null;
}

export type CompanySummary = Company;

export type FacilityType = "warehouse" | "hub";

export interface CompanyFacilitySummary {
  id: string;
  name: string;
  type: FacilityType;
  address: string;
}

export interface CompaniesPage {
  // Companies returned for the requested page.
  companies: CompanySummary[];
  // Total number of companies matching the query.
  total: number;
  // Current page number, starting at 1.
  page: number;
  // Maximum number of companies per page.
  page_size: number;
}

export interface CompanyResponse {
  // Company returned by a detail, create, or update request.
  company: CompanySummary;
  // Default warehouse created with the company, when provided on create.
  facility?: CompanyFacilitySummary | null;
}

export interface CompanyMember {
  // Unique identifier (UUID) of the assigned user.
  id: string;
  // Display name of the user.
  name: string;
  // Email address of the user, when available.
  email: string | null;
  // ISO date string when the user was assigned to the company.
  assigned_at: string;
  // Roles assigned to this company membership.
  roles: { id: string; name: string }[];
}

export interface CompanyMembersPage {
  // Members returned for the requested page.
  members: CompanyMember[];
  // Total number of accessible members matching the query.
  total: number;
  // Current page number, starting at 1.
  page: number;
  // Maximum number of members per page.
  page_size: number;
}

export interface CreateCompanyInput {
  code?: string;
  // Display name of the new company.
  name: string;
  // Optional default warehouse name.
  facility_name?: string;
  // Optional warehouse address when facility_name is set.
  facility_address?: string;
}

export interface UpdateCompanyInput {
  code?: string;
  // UUID of the company to update.
  id: string;
  // Display name of the company.
  name: string;
}

export interface DeleteCompanyResponse {
  // UUID of the deleted company.
  id: string;
  // Result message returned by the API.
  message: string;
}
