import type { AccessScope } from "@/lib/auth/access-scope";
import type { CompanyOption } from "./companies";

export type RoleScope = "global" | "company";

export interface RoleOption {
  // Unique identifier (UUID) of the role.
  id: string;
  // Display name of the role.
  name: string;
  // Machine-readable identifier of the role.
  slug: string;
  // UUID of the owning company, when the role is company-specific.
  company_id?: string | null;
}

export interface AssignableRole extends RoleOption {
  // Page keys enabled for this role.
  pages: string[];
  // Permission keys enabled for this role.
  permissions: string[];
  // Optional access scope for each permission.
  permission_scopes: Partial<Record<string, AccessScope>>;
}

export interface Role {
  // Unique identifier (UUID) of the role.
  id: string;
  // Display name of the role.
  name: string;
  // Machine-readable identifier of the role.
  slug: string;
  // Whether the role is assigned globally or through company memberships.
  scope: RoleScope;
  // UUID of the owning company, or null for a shared role template.
  company_id: string | null;
  // UUID of the user who created the role, when recorded.
  created_by: string | null;
  // Owning company's display information, when applicable.
  company: CompanyOption | null;
  // Whether the application protects this role from editing and deletion.
  is_system: boolean;
  // Whether this role is a default company role.
  is_default_role: boolean;
  // ISO date string when the role was created.
  created_at: string;
  // ISO date string when the role was last updated.
  updated_at: string;
  // Page keys enabled for this role.
  pages: string[];
  // Permission keys enabled for this role.
  permissions: string[];
  // Access scope associated with each scoped permission.
  permission_scopes: Record<string, AccessScope>;
  // Total global-user and company-membership assignments of this role.
  assignment_count: number;
}

export type RoleSummary = Role;

export interface RolesPage {
  // Roles returned for the requested page.
  roles: RoleSummary[];
  // Total number of roles matching the query.
  total: number;
  // Current page number, starting at 1.
  page: number;
  // Maximum number of roles per page.
  page_size: number;
}

export interface RoleResponse {
  // Role returned by a detail, create, or update request.
  role: RoleSummary;
}

export interface RoleAssignment {
  // UUID of the user for a global role, or membership for a company role.
  id: string;
  // Display name of the assigned user.
  name: string;
  // Company name for membership assignments, or null for global assignments.
  company: string | null;
}

export interface RoleAssignmentsPage {
  // Accessible assignments returned for this page.
  assignments: RoleAssignment[];
  // Total number of accessible assignments matching the query.
  total: number;
  // Current page number, starting at 1.
  page: number;
  // Maximum number of assignments per page.
  page_size: number;
}

export interface CreateRoleInput {
  // Display name of the new role.
  name: string;
  // Optional machine-readable identifier; generated when omitted.
  slug?: string;
  // Assignment scope of the role.
  scope?: RoleScope;
  // Owning company UUID, or null for a shared role template.
  company_id?: string | null;
  // Whether this role is a default company role.
  is_default_role?: boolean;
  // Page keys to enable.
  pages?: string[];
  // Permission keys to enable.
  permissions?: string[];
  // Access scopes for selected permissions.
  permission_scopes?: Record<string, AccessScope>;
}

export interface UpdateRoleInput {
  // UUID of the role to update.
  id: string;
  // Updated display name, when supplied.
  name?: string;
  // Updated owning company UUID, when supported.
  company_id?: string | null;
  // Updated default-role setting.
  is_default_role?: boolean;
  // Updated enabled page keys.
  pages?: string[];
  // Updated enabled permission keys.
  permissions?: string[];
  // Updated access scopes for selected permissions.
  permission_scopes?: Record<string, AccessScope>;
}

export interface RolePageOption {
  // Machine-readable page key.
  key: string;
  // Display label of the page.
  label: string;
  // Application route associated with the page.
  href: string;
}

export interface RolePermissionOption {
  // Machine-readable permission key.
  key: string;
  // Display label of the permission.
  label: string;
  // Page key associated with this permission.
  page_key: string;
  // Action permitted; add is displayed as Create.
  action: "view" | "edit" | "add" | "delete";
}

export interface RoleOptions {
  // Companies available to the role editor.
  companies: CompanyOption[];
  // Supported assignment scopes.
  scopes: RoleScope[];
  // Pages that can be enabled for a role.
  pages: RolePageOption[];
  // Permissions that can be enabled for a role.
  permissions: RolePermissionOption[];
}

export interface DeleteRoleResponse {
  // UUID of the deleted role.
  id: string;
  // Result message returned by the API.
  message: string;
}
