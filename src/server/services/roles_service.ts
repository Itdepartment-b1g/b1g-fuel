import type { CreateRoleInput, UpdateRoleInput, RoleScope, RoleSummary, RoleOptions } from "@/server/schema/roles_schema";
import { PAGE_CATALOG } from "@/lib/auth/catalog";
import { PERMISSION_CATALOG } from "@/lib/auth/permissions";
import * as rolesRepository from "@/server/repositories/roles_repository";
import { getDatabase } from "@/server/utils/database";
import { RoleError } from "@/server/utils/errors";
import type { Pagination } from "@/server/utils/pagination";

function require_editable_role(role: RoleSummary | null): RoleSummary {
  if (!role) throw new RoleError("role_not_found", "Role not found.");
  if (role.is_system || role.slug === "super_admin") throw new RoleError("system_role", "System roles cannot be changed or deleted.");
  return role;
}
export function create_role_service(repository = rolesRepository) {
  return {
    list_role(pagination: Pagination, search: string, scope?: RoleScope) { return repository.list_role(pagination, search, scope); },
    async edit_role(id: string) {
      const role = await repository.list_by_id_role(id);
      if (!role) throw new RoleError("role_not_found", "Role not found.");
      return role;
    },
    get_role_option(): RoleOptions { return { scopes: ["company", "global"], pages: PAGE_CATALOG.map(({ key, label, href }) => ({ key, label, href })), permissions: [...PERMISSION_CATALOG] }; },
    create_role(input: Required<CreateRoleInput>) {
      if (input.slug === "super_admin") throw new RoleError("system_role", "The super_admin role is managed by the application.");
      if (input.scope === "global" && input.is_default_role) throw new RoleError("company_default_required", "Only company roles can be default roles.");
      return repository.create_role(input);
    },
    update_role(input: UpdateRoleInput) {
      return getDatabase().transaction(async (transaction) => {
        const current = require_editable_role(await repository.list_by_id_role(input.id, transaction));
        if (current.scope === "global" && input.is_default_role) throw new RoleError("company_default_required", "Only company roles can be default roles.");
        const role = await repository.update_role(input, { is_system: current.is_system, slug: current.slug, scope: current.scope }, transaction);
        if (!role) throw new RoleError("role_changed", "Role changed while editing. Refresh and try again.");
        return role;
      });
    },
    delete_role(id: string) {
      return getDatabase().transaction(async (transaction) => {
        const current = require_editable_role(await repository.list_by_id_role(id, transaction));
        if (current.assignment_count > 0) throw new RoleError("role_assigned", "This role is assigned to users and cannot be deleted.");
        if (!await repository.delete_role(id, { is_system: current.is_system, slug: current.slug, scope: current.scope }, transaction)) throw new RoleError("role_changed", "Role changed while deleting. Refresh and try again.");
        return { id, message: "Role deleted." };
      });
    },
  };
}
export const roleService = create_role_service();
