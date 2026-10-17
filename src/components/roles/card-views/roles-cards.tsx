"use client";

import { useState } from "react";
import { Eye, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { CardActionsMenu } from "@/components/common/card-actions-menu";
import { useRecordAccess } from "@/components/providers/access-provider";
import type { RoleSummary } from "@/types/roles";
import { ViewRoleDialog } from "../dialog/view-role-dialog";
import { RoleLabels, type RoleActionProps } from "../table-view/roles-table-view";

export function RolesCards({
  roles,
  onEdit,
  onDelete,
  disabled,
}: RoleActionProps & { roles: RoleSummary[] }) {
  const access = useRecordAccess();
  const [viewing, setViewing] = useState<RoleSummary | null>(null);
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
      {roles.map((role) => {
        const protectedRole = !access?.superAdmin || role.is_system || role.slug === "super_admin";
        return (
        <article key={role.id} className="rounded-xl border p-5">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-semibold">{role.name}</h2>
              <p className="text-xs text-muted-foreground">{role.slug}</p>
            </div>
            <CardActionsMenu
              label={`Actions for ${role.name}`}
              items={[
                { id: "view", label: "View", icon: <Eye />, onSelect: () => setViewing(role) },
                {
                  id: "edit",
                  label: "Edit",
                  icon: <Pencil />,
                  description: protectedRole ? "System roles are managed by the application" : undefined,
                  disabled: disabled || protectedRole,
                  onSelect: () => onEdit(role),
                },
                {
                  id: "delete",
                  label: "Delete",
                  icon: <Trash2 />,
                  destructive: true,
                  description: protectedRole
                    ? "System roles cannot be deleted"
                    : role.assignment_count
                      ? "Assigned roles cannot be deleted"
                      : undefined,
                  disabled: disabled || protectedRole || role.assignment_count > 0,
                  onSelect: () => onDelete(role),
                },
              ]}
            />
          </div>
          <RoleLabels role={role} />
          <p className="mt-4 text-sm text-muted-foreground">
            {role.slug === "super_admin"
              ? "Full dashboard access"
              : `${role.pages.length} pages · ${role.permissions.length} permissions`}
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            {role.assignment_count} assignments
          </p>
        </article>
        );
      })}
      {viewing && <ViewRoleDialog role={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
