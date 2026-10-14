export const ROLE_SORT_FIELDS = ["id","name","slug","scope","is_default_role","created_at","updated_at"] as const;

export type {
  RoleScope,
  RoleSummary,
  RolesPage,
  RoleResponse,
  RoleAssignmentsPage,
  CreateRoleInput,
  UpdateRoleInput,
  RoleOptions,
  DeleteRoleResponse,
} from "@/types/roles";
