import type { QuickFilterState } from "@/types/quick-filter";
import { ROLE_FILTER_OPTIONS } from "@/utils/management-filters";
import { build_filter_options } from "@/server/lib/quick-filters";
import type { RecordAccess } from "@/server/auth/record-access";
import type { Sorting } from "@/server/lib/sorting";
import type {
  CreateRoleInput,
  UpdateRoleInput,
  RoleScope,
  RoleSummary,
} from "@/server/schema/roles_schema";
import * as rolesRepository from "@/server/repositories/roles_repository";
import { getDatabase } from "@/server/lib/database";
import type { Pagination } from "@/server/lib/pagination";
import { PERMISSION_CATALOG } from "@/lib/auth/permissions";
import { ACCESS_SCOPES, type AccessScope } from "@/lib/auth/access-scope";

function require_permission_scopes(permissions: string[], scopes: Record<string, AccessScope>) {
  for (const [key, value] of Object.entries(scopes)) {
    if (!permissions.includes(key) || key.endsWith(".add") || !ACCESS_SCOPES.includes(value))
      throw new RoleError("invalid_input", "Access scopes must belong to selected View, Edit, or Delete permissions.");
  }
}

export async function list_role_assignments(id: string, pagination: Pagination, access?: RecordAccess) {
  const result = await rolesRepository.list_role_assignments(id, pagination, access);
  if (!result) throw new RoleError("role_not_found", "Role not found.");
  return result;
}

function require_page_permissions(pages: string[], permissions: string[]) {
  if (permissions.some((key) => {
    const permission = PERMISSION_CATALOG.find((choice) => choice.key === key);
    return !permission || !pages.includes(permission.page_key);
  })) throw new RoleError("invalid_input", "Select each permission's page before assigning its permissions.");
}

function require_editable_role(role: RoleSummary | null): RoleSummary {
  if (!role) throw new RoleError("role_not_found", "Role not found.");
  if (role.is_system || role.slug === "super_admin")
    throw new RoleError(
      "system_role",
      "System roles cannot be changed or deleted.",
    );
  return role;
}
export async function create_role(input: Required<CreateRoleInput>, repository = rolesRepository, createdBy?: string) {
  require_page_permissions(input.pages, input.permissions);
  require_permission_scopes(input.permissions, input.permission_scopes);
  if (input.scope === "global" && input.company_id)
    throw new RoleError("invalid_input", "Global roles cannot belong to a company.");
  if (input.slug === "super_admin")
    throw new RoleError(
      "system_role",
      "The super_admin role is managed by the application.",
    );
  if (input.scope === "global" && input.is_default_role)
    throw new RoleError(
      "company_default_required",
      "Only company roles can be default roles.",
    );
  return repository.create_role(input, createdBy);
}

export async function list_role(
  pagination: Pagination,
  search: string,
  scope?: RoleScope,
  sorting?: Sorting,
  repository = rolesRepository,
  access?: RecordAccess,
  filters?: QuickFilterState,
) {
  return repository.list_role(pagination, search, scope, sorting, access, filters);
}

export async function list_by_id_role(id: string, repository = rolesRepository, access?: RecordAccess) {
  const role = await repository.list_by_id_role(id, undefined, access);
  if (!role) throw new RoleError("role_not_found", "Role not found.");
  return role;
}

export async function delete_role(id: string, repository = rolesRepository) {
  return getDatabase().$transaction(async (transaction) => {
    const current = require_editable_role(
      await repository.list_by_id_role(id, transaction),
    );
    if (current.assignment_count > 0)
      throw new RoleError(
        "role_assigned",
        "This role is assigned to users and cannot be deleted.",
      );
    if (
      !(await repository.delete_role(
        id,
        {
          is_system: current.is_system,
          slug: current.slug,
          scope: current.scope,
        },
        transaction,
      ))
    )
      throw new RoleError(
        "role_changed",
        "Role changed while deleting. Refresh and try again.",
      );
    return { id, message: "Role deleted." };
  });
}

export async function update_role(input: UpdateRoleInput, repository = rolesRepository) {
  return getDatabase().$transaction(async (transaction) => {
    const current = require_editable_role(
      await repository.list_by_id_role(input.id, transaction),
    );
    if (input.pages !== undefined || input.permissions !== undefined)
      require_page_permissions(input.pages ?? current.pages, input.permissions ?? current.permissions);
    if (input.permission_scopes !== undefined || input.permissions !== undefined) {
      const permissions = input.permissions ?? current.permissions;
      const scopes = Object.fromEntries(permissions.filter((key) => !key.endsWith(".add")).map((key) => [key, input.permission_scopes?.[key] ?? current.permission_scopes[key] ?? "company"]));
      require_permission_scopes(permissions, input.permission_scopes ?? {});
      require_permission_scopes(permissions, scopes);
      input = { ...input, permission_scopes: scopes };
    }
    if (current.scope === "global" && input.company_id)
      throw new RoleError("invalid_input", "Global roles cannot belong to a company.");
    if (input.company_id !== undefined && input.company_id !== current.company_id && current.assignment_count > 0)
      throw new RoleError("role_assigned", "Remove this role's user assignments before changing its company.");
    if (current.scope === "global" && input.is_default_role)
      throw new RoleError(
        "company_default_required",
        "Only company roles can be default roles.",
      );
    const role = await repository.update_role(
      input,
      {
        is_system: current.is_system,
        slug: current.slug,
        scope: current.scope,
      },
      transaction,
    );
    if (!role)
      throw new RoleError(
        "role_changed",
        "Role changed while editing. Refresh and try again.",
      );
    return role;
  });
}

export type RoleErrorCode = "invalid_input" | "role_not_found" | "system_role" | "company_default_required" | "role_changed" | "role_assigned";

export class RoleError extends Error {
  constructor(public code: RoleErrorCode, message: string) { super(message); }
}

export async function get_role_filter_option(repository = rolesRepository, access?: RecordAccess) {
  const records = await repository.get_role_filter_data(access);
  return build_filter_options(records, ROLE_FILTER_OPTIONS,
    (role, field) => field === "company" ? (role.company ? { value: role.company.id, label: role.company.name } : null) : { value: field === "slug" ? role.slug : role.name, label: field === "slug" ? role.slug : role.name },
    (role, status) => (role._count.user_roles + role._count.company_roles > 0) === (status === "assigned"),
    (role, key, value) => key === "scope" ? role.scope === value : key === "type" ? role.is_system === (value === "system") : role.is_default_role === (value === "default"),
  );
}
