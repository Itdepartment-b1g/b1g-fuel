import type { RoleSummary } from "@/server/schema/roles_schema";
import type { RoleActionProps } from "../role-details";
import { RoleCard } from "./role-card";

export function RolesCards({ roles, onEdit, onDelete, disabled }: RoleActionProps & { roles: RoleSummary[] }) {
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
      {roles.map((role) => (
        <RoleCard key={role.id} role={role} onEdit={onEdit} onDelete={onDelete} disabled={disabled} />
      ))}
    </div>
  );
}
