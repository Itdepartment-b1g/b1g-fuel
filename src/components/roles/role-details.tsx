import { LockKeyhole, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RoleSummary } from "@/server/schema/roles_schema";

export type RoleActionProps = {
  onEdit: (role: RoleSummary) => void;
  onDelete: (role: RoleSummary) => void;
  disabled: boolean;
};

export function RoleActions({
  role,
  onEdit,
  onDelete,
  disabled,
}: RoleActionProps & { role: RoleSummary }) {
  const protectedRole = role.is_system || role.slug === "super_admin";
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Edit ${role.name}`}
        title={
          protectedRole
            ? "System roles are managed by the application"
            : "Edit role"
        }
        disabled={disabled || protectedRole}
        onClick={() => onEdit(role)}
      >
        <Pencil className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Delete ${role.name}`}
        title={
          protectedRole
            ? "System roles cannot be deleted"
            : role.assignment_count
              ? "Assigned roles cannot be deleted"
              : "Delete role"
        }
        disabled={disabled || protectedRole || role.assignment_count > 0}
        onClick={() => onDelete(role)}
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </div>
  );
}
export function RoleLabels({ role }: { role: RoleSummary }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
        {role.scope === "global" ? "Global" : "Company"}
      </span>
      {role.is_system && (
        <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
          <LockKeyhole className="size-3" aria-hidden="true" />
          System
        </span>
      )}
      {role.is_default_role && (
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
          Default
        </span>
      )}
    </div>
  );
}
