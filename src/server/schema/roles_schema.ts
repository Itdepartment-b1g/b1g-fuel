import type { AccessScope } from "@/lib/auth/access-scope";

export const ROLE_SORT_FIELDS = [
  "id",
  "name",
  "slug",
  "scope",
  "is_default_role",
  "created_at",
  "updated_at",
] as const;

export type RoleScope = "global" | "company";

export interface RoleSummary {
  id: string;
  name: string;
  slug: string;
  scope: RoleScope;
  company_id: string | null;
  created_by: string | null;
  created_by_name?: string | null;
  company: { id: string; name: string } | null;
  is_system: boolean;
  is_default_role: boolean;
  created_at: string;
  updated_at: string;
  pages: string[];
  permissions: string[];
  permission_scopes: Record<string, AccessScope>;
  assignment_count: number;
}

export interface CreateRoleInput {
  name: string;
  slug?: string;
  scope?: RoleScope;
  company_id?: string | null;
  is_default_role?: boolean;
  pages?: string[];
  permissions?: string[];
  permission_scopes?: Record<string, AccessScope>;
}

export interface UpdateRoleInput {
  id: string;
  name?: string;
  company_id?: string | null;
  is_default_role?: boolean;
  pages?: string[];
  permissions?: string[];
  permission_scopes?: Record<string, AccessScope>;
}
