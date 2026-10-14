export interface CompanyOption {
  // Unique identifier (UUID) of the company.
  id: string;
  // Display name of the company.
  name: string;
}

export interface Company extends CompanyOption {
  // UUID of the user who created the company, when recorded.
  created_by: string | null;
  // ISO date string when the company was created.
  created_at: string;
  // ISO date string when the company was last updated.
  updated_at: string;
  // Number of users with a membership in this company.
  member_count: number;
}

export type CompanySummary = Company;

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
  // Display name of the new company.
  name: string;
}

export interface UpdateCompanyInput extends CreateCompanyInput {
  // UUID of the company to update.
  id: string;
}

export interface DeleteCompanyResponse {
  // UUID of the deleted company.
  id: string;
  // Result message returned by the API.
  message: string;
}
