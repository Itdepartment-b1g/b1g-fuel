import type { AccessScope } from "@/lib/auth/access-scope";

export const USER_SORT_FIELDS = ["id", "name", "email", "created_at", "updated_at"] as const;

export interface UserRoleOption {
  id: string;
  name: string;
  slug: string;
  company_id: string | null;
}

export type PageGrantMode = "role_pages" | "assigned_pages";

export interface UserCompanyMembership {
  id: string;
  name: string;
  roles: UserRoleOption[];
  page_grant_mode: PageGrantMode;
  pages: string[];
  permissions: string[];
  permission_scopes: Partial<Record<string, AccessScope>>;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  global_roles: UserRoleOption[];
  companies: UserCompanyMembership[];
}

export interface AssignableRole extends UserRoleOption {
  pages: string[];
  permissions: string[];
  permission_scopes: Partial<Record<string, AccessScope>>;
  created_at: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  company_id?: string;
  role_ids?: string[];
  role_name?: string;
  role_id?: string;
  page_keys?: string[];
  permissions?: string[];
  permission_scopes?: Partial<Record<string, AccessScope>>;
  permission_rows?: { permission_key: string; access_scope: string }[];
}

export interface UpdateUserInput {
  id: string;
  name?: string;
  email?: string | null;
}
