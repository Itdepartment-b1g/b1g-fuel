import type {
  CreateRoleInput,
  UpdateRoleInput,
  RoleScope,
  RoleSummary,
} from "@/server/schema/roles_schema";
import * as rolesRepository from "@/server/repositories/roles_repository";
import { getDatabase } from "@/server/utils/database";
import type { Pagination } from "@/server/utils/pagination";

function require_editable_role(role: RoleSummary | null): RoleSummary {
  if (!role) throw new RoleError("role_not_found", "Role not found.");
  if (role.is_system || role.slug === "super_admin")
    throw new RoleError(
      "system_role",
      "System roles cannot be changed or deleted.",
    );
  return role;
}
export async function create_role(input: Required<CreateRoleInput>, repository = rolesRepository) {
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
  return repository.create_role(input);
}

export async function list_role(
  pagination: Pagination,
  search: string,
  scope?: RoleScope,
  repository = rolesRepository,
) {
  return repository.list_role(pagination, search, scope);
}

export async function list_by_id_role(id: string, repository = rolesRepository) {
  const role = await repository.list_by_id_role(id);
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
