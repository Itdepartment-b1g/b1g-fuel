"use client";

import { Pencil, Trash2 } from "lucide-react";
import { DataTable } from "@/components/common/data-table";
import type { TableSort } from "@/lib/table";
import type { RoleSummary } from "@/server/schema/roles_schema";
import { RoleLabels, type RoleActionProps } from "../role-details";

type Props = RoleActionProps & {
  roles: RoleSummary[];
  loading?: boolean;
  sorting?: TableSort | null;
  onSortingChange?: (sorting: TableSort | null) => void;
};

export function RolesTable(props: Props) {
  const protectedRole = (role: RoleSummary) =>
    role.is_system || role.slug === "super_admin";
  return (
    <DataTable
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
              <p className="font-medium">{role.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{role.slug}</p>
            </>
          ),
        },
        {
          id: "scope",
          header: "Scope / type",
          width: 220,
          sortable: true,
          freezable: true,
          value: (role) => role.scope,
          cell: (role) => <RoleLabels role={role} />,
        },
        {
          id: "access",
          header: "Access",
          width: 260,
          freezable: true,
          cell: (role) =>
            role.slug === "super_admin"
              ? "Full dashboard access"
              : role.pages.length +
                " pages / " +
                role.permissions.length +
                " permissions",
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
