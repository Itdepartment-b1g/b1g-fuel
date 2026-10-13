"use client";

import { useRecordAccess } from "@/components/providers/access-provider";
import { LockKeyhole, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableView } from "@/components/common/table-view";
import type { TableSort } from "@/lib/table";
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
  const access = useRecordAccess();
  const protectedRole = !access?.superAdmin || role.is_system || role.slug === "super_admin";
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

type Props = RoleActionProps & {
  roles: RoleSummary[];
  loading?: boolean;
  sorting?: TableSort | null;
  onSortingChange?: (sorting: TableSort | null) => void;
};

export function RolesTableView(props: Props) {
  const access = useRecordAccess();
  const protectedRole = (role: RoleSummary) =>
    !access?.superAdmin || role.is_system || role.slug === "super_admin";
  return (
    <TableView
      data={props.roles}
      rowKey={(role) => role.id}
      caption="Role definitions and assignments"
      sortingMode={props.onSortingChange ? "server" : "client"}
      sorting={props.sorting}
      onSortingChange={props.onSortingChange}
      loading={props.loading}
      multipleFrozenColumns
      actionsDisabled={props.disabled}
      columns={[
        {
          id: "name",
          header: "Role",
          width: 250,
          
          sortable: true,
          freezable: true,
          value: (role) => role.name,
          cell: (role) => (
            <>
              <p className="font-bold uppercase">{role.name}</p>
            </>
          ),
        },
        {
          id: "slug",
          header: "Slug",
          width: 250,
          sortable: true,
          freezable: true,
          value: (role) => role.name,
          cell: (role) => (
            <>
              <p className="text-gray-500">{role.slug}</p>
            </>
          ),
        },
        {
          id: "scope",
          header: "Scope",
          sortable: true,
          freezable: true,
          value: (role) => role.scope,
          cell: (role) =>
            [
              role.scope === "global" ? "Global" : "Company",
              role.is_system ? "System" : null,
              role.is_default_role ? "Default" : null,
            ]
              .filter(Boolean)
              .join(", "),
        },
        {
          id: "access",
          header: "Access",
          width: 260,
          freezable: true,
          className:"text-xs text-gray-500",
          cell: (role) =>
            role.slug === "super_admin"
              ? "FULL DASHBOARD ACCESS"
              : role.pages.length +
                " PAGES / " +
                role.permissions.length +
                " PERMISSIONS",
        },
        {
          id: "assignment_count",
          header: "Assignments",
          width: 150,
          freezable: true,
          value: (role) => role.assignment_count,
        },
      ]}
      actions={[
        {
          id: "edit",
          label: "Edit",
          icon: <Pencil />,
       
          disabled: protectedRole,
          onSelect: props.onEdit,
        },
        {
          id: "delete",
          label: "Delete",
          className: "border-gray-200 text-destructive",
          icon: <Trash2 />,
          destructive: true,
          disabled: (role) => protectedRole(role) || role.assignment_count > 0,
          description: (role) =>
            protectedRole(role)
              ? "System roles cannot be deleted"
              : role.assignment_count
                ? "Assigned roles cannot be deleted"
                : undefined,
          onSelect: props.onDelete,
        },
      ]}
    />
  );
}
