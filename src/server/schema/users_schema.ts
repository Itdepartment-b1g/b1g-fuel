export const USER_SORT_FIELDS = ["id","name","email","created_at","updated_at"] as const;

export type RoleOption = { id: string; name: string; slug: string };
export type CompanyOption = { id: string; name: string };
export type UserSummary = {
  id: string;
  name: string;
  email: string | null;
  created_at: string;
  global_roles: RoleOption[];
  companies: (CompanyOption & { roles: RoleOption[] })[];
};
export type UsersPage = {
  users: UserSummary[];
  total: number;
  page: number;
  page_size: number;
};
export type UserOptions = { companies: CompanyOption[]; roles: RoleOption[] };
export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  company_id?: string;
  role_ids?: string[];
};
export type UpdateUserInput = { id: string; name?: string; email?: string | null };
export type CreateUserResponse = { user: UserSummary };
