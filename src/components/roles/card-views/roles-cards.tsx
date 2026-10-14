import { ShieldCheck } from "lucide-react";
import type { RoleSummary } from "@/server/schema/roles_schema";
import {
  RoleActions,
  RoleLabels,
  type RoleActionProps,
} from "../table-view/roles-table-view";

export function RolesCards({
  roles,
  onEdit,
  onDelete,
  disabled,
}: RoleActionProps & { roles: RoleSummary[] }) {
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
      {roles.map((role) => (
        <article key={role.id} className="rounded-xl border p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-semibold">{role.name}</h2>
              <p className="text-xs text-muted-foreground">{role.slug}</p>
            </div>
          </div>
          <RoleLabels role={role} />
          <p className="mt-4 text-sm text-muted-foreground">
            {role.slug === "super_admin"
              ? "Full dashboard access"
              : `${role.pages.length} pages · ${role.permissions.length} permissions`}
          </p>
          <div className="mt-4 flex items-center justify-between border-t pt-3">
            <span className="text-xs text-muted-foreground">
              {role.assignment_count} assignments
            </span>
            <RoleActions
              role={role}
              onEdit={onEdit}
              onDelete={onDelete}
              disabled={disabled}
            />
          </div>
        </article>
      ))}
    </div>
  );
}
