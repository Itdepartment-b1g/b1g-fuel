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
export type UsersPage = { users: UserSummary[]; total: number; page: number; page_size: number };
export type UserOptions = { companies: CompanyOption[]; roles: RoleOption[] };
export type CreateUserInput = { name: string; email: string; password: string; company_id?: string; role_ids?: string[] };
export type CreateUserResponse = { user: UserSummary };
