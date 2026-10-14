import type { AccessScope } from "@/lib/auth/access-scope";

export const ROLE_SORT_FIELDS = ["id","name","slug","scope","is_default_role","created_at","updated_at"] as const;

export type RoleScope = "global" | "company";
export type RoleSummary = {
  id: string;
  name: string;
  slug: string;
  scope: RoleScope;
  company_id: string | null;
  created_by: string | null;
  company: { id: string; name: string } | null;
  is_system: boolean;
  is_default_role: boolean;
  created_at: string;
  updated_at: string;
  pages: string[];
  permissions: string[];
  permission_scopes: Record<string, AccessScope>;
  assignment_count: number;
};
export type RolesPage = {
  roles: RoleSummary[];
  total: number;
  page: number;
  page_size: number;
};
export type RoleResponse = { role: RoleSummary };
export type RoleAssignmentsPage = {
  assignments: { id: string; name: string; company: string | null }[];
  total: number;
  page: number;
  page_size: number;
};
export type CreateRoleInput = {
  name: string;
  slug?: string;
  scope?: RoleScope;
  company_id?: string | null;
  is_default_role?: boolean;
  pages?: string[];
  permissions?: string[];
  permission_scopes?: Record<string, AccessScope>;
};
export type UpdateRoleInput = {
  id: string;
  name?: string;
  company_id?: string | null;
  is_default_role?: boolean;
  pages?: string[];
  permissions?: string[];
  permission_scopes?: Record<string, AccessScope>;
};
export type RoleOptions = {
  companies: { id: string; name: string }[];
  scopes: RoleScope[];
  pages: { key: string; label: string; href: string }[];
  permissions: { key: string; label: string; page_key: string; action: "view" | "edit" | "add" | "delete" }[];
};
export type DeleteRoleResponse = { id: string; message: string };
