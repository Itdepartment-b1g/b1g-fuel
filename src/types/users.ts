import type { CompanyOption } from "./companies";
import type { AssignableRole, RoleOption } from "./roles";

export type { CompanyOption } from "./companies";
export type { AssignableRole, RoleOption } from "./roles";

export interface UserCompany extends CompanyOption {
  // Roles assigned to the user's membership in this company.
  roles: RoleOption[];
}

export interface User {
  // Unique identifier (UUID), matching the user's authentication account.
  id: string;
  // Display name of the user.
  name: string;
  // Email address of the user, when available.
  email: string | null;
  // UUID of the user who created this account, when recorded.
  created_by: string | null;
  // Display name of the account creator, when available.
  created_by_name: string | null;
  // ISO date string when the user was created.
  created_at: string;
  // Roles assigned globally to this user.
  global_roles: RoleOption[];
  // Company memberships and their assigned roles.
  companies: UserCompany[];
}

export type UserSummary = User;

export interface UsersPage {
  // Users returned for the requested page.
  users: UserSummary[];
  // Total number of users matching the query.
  total: number;
  // Current page number, starting at 1.
  page: number;
  // Maximum number of users per page.
  page_size: number;
}

export interface UserOptions {
  // Companies available for user membership assignment.
  companies: CompanyOption[];
  // Roles available for company membership assignment.
  roles: AssignableRole[];
}

export interface CreateUserInput {
  // Display name of the new user.
  name: string;
  // Email address used for authentication.
  email: string;
  // Initial password; sent only when creating the account.
  password: string;
  // Optional UUID of the initial company membership.
  company_id?: string;
  // Optional role UUIDs for the initial company membership.
  role_ids?: string[];
}

export interface UpdateUserInput {
  // UUID of the user to update.
  id: string;
  // Updated display name, when supplied.
  name?: string;
  // Updated email address, or null to clear it.
  email?: string | null;
}

export interface AssignUserInput {
  // UUID of the user receiving the assignment.
  id: string;
  // UUID of the company membership to create or update.
  company_id: string;
  // Role UUIDs to assign to the company membership.
  role_ids: string[];
}

export interface CreateUserResponse {
  // User returned after creation.
  user: UserSummary;
}
