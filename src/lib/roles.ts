export type RoleScope = "global" | "company";
export type RoleSummary = {
  id: string; name: string; slug: string; scope: RoleScope;
  is_system: boolean; is_default_role: boolean;
  created_at: string; updated_at: string;
  pages: string[]; permissions: string[];
  assignment_count: number;
};
export type RolesPage = { roles: RoleSummary[]; total: number; page: number; page_size: number };
export type RoleResponse = { role: RoleSummary };
export type CreateRoleInput = {
  name: string; slug?: string; scope?: RoleScope; is_default_role?: boolean;
  pages?: string[]; permissions?: string[];
};
export type UpdateRoleInput = {
  id: string; name?: string; is_default_role?: boolean; pages?: string[]; permissions?: string[];
};
export type RoleOptions = {
  scopes: RoleScope[];
  pages: { key: string; label: string; href: string }[];
  permissions: { key: string; label: string }[];
};
export type DeleteRoleResponse = { id: string; message: string };
