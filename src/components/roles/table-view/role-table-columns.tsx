import type { TableColumn } from "@/components/common/table/table-view";
import type { RoleSummary } from "@/types/roles";

export const ROLE_TABLE_COLUMNS: TableColumn<RoleSummary>[] = [
  {
    id: "name",
    header: "Role",
    width: 250,
    sortable: true,
    freezable: true,
    value: (role) => role.name,
    cell: (role) => <p className="font-bold uppercase">{role.name}</p>,
  },
  {
    id: "slug",
    header: "Slug",
    width: 250,
    sortable: true,
    freezable: true,
    value: (role) => role.name,
    cell: (role) => <p className="text-gray-500">{role.slug}</p>,
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
    className: "text-xs text-gray-500",
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
  {
    id: "created_by",
    header: "Created by",
    freezable: true,
    value: (role) => role.created_by_name,
    cell: (role) => role.created_by_name ?? "—",
  },
];
