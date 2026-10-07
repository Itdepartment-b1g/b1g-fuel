import type { CreateRoleInput, UpdateRoleInput, RoleScope, RoleSummary, RoleOptions } from "@/lib/roles";
import { PAGE_CATALOG } from "@/lib/auth/catalog";
import { PERMISSION_CATALOG } from "@/lib/auth/permissions";
import { rolesRepository } from "@/server/repositories/roles_repository";
import { RoleError } from "@/server/utils/errors";
import type { Pagination } from "@/server/utils/pagination";

function requireEditableRole(role: RoleSummary | null): RoleSummary {
  if (!role) throw new RoleError(404, "Role not found.");
  if (role.is_system || role.slug === "super_admin") throw new RoleError(403, "System roles cannot be changed or deleted.");
  return role;
}
export function createRoleService(repository = rolesRepository) {
  return {
    listRole(pagination: Pagination, search: string, scope?: RoleScope) { return repository.listRole(pagination, search, scope); },
    async editRole(id: string) {
      const role = await repository.getRole(id);
      if (!role) throw new RoleError(404, "Role not found.");
      return role;
    },
    getRoleOption(): RoleOptions { return { scopes: ["company", "global"], pages: PAGE_CATALOG.map(({ key, label, href }) => ({ key, label, href })), permissions: [...PERMISSION_CATALOG] }; },
    createRole(input: Required<CreateRoleInput>) {
      if (input.slug === "super_admin") throw new RoleError(403, "The super_admin role is managed by the application.");
      if (input.scope === "global" && input.is_default_role) throw new RoleError(400, "Only company roles can be default roles.");
      return repository.createRole(input);
    },
    updateRole(input: UpdateRoleInput) {
      return repository.runRoleTransaction(async (transaction) => {
        const current = requireEditableRole(await transaction.getRole(input.id));
        if (current.scope === "global" && input.is_default_role) throw new RoleError(400, "Only company roles can be default roles.");
        const role = await transaction.updateRole(input, { is_system: current.is_system, slug: current.slug, scope: current.scope });
        if (!role) throw new RoleError(409, "Role changed while editing. Refresh and try again.");
        return role;
      });
    },
    deleteRole(id: string) {
      return repository.runRoleTransaction(async (transaction) => {
        const current = requireEditableRole(await transaction.getRole(id));
        if (current.assignment_count > 0) throw new RoleError(409, "This role is assigned to users and cannot be deleted.");
        if (!await transaction.deleteRole(id, { is_system: current.is_system, slug: current.slug, scope: current.scope })) throw new RoleError(409, "Role changed while deleting. Refresh and try again.");
        return { id, message: "Role deleted." };
      });
    },
  };
}
export const roleService = createRoleService();
