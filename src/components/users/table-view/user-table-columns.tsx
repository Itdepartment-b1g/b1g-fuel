import type { TableColumn } from "@/components/common/table/table-view";
import type { UserSummary } from "@/types/users";
import { formatDate } from "@/utils/date";

export const USER_TABLE_COLUMNS: TableColumn<UserSummary>[] = [
  {
    id: "name",
    header: "Name",
    className: "font-bold",
    sortable: true,
    freezable: true,
    value: (user) => user.name,
    cell: (user) => user.name,
  },
  {
    id: "email",
    header: "Email",
    sortable: true,
    freezable: true,
    value: (user) => user.email,
    cell: (user) => user.email ?? "—",
  },
  {
    id: "company",
    header: "Company",
    freezable: true,
    cell: (user) =>
      user.companies.length
        ? user.companies.map((company) => company.name).join(", ")
        : "—",
  },
  {
    id: "roles",
    header: "Roles",
    freezable: true,
    className: "font-bold uppercase",
    cell: (user) => {
      const names = [
        ...user.global_roles.map((role) => role.name),
        ...user.companies.flatMap((company) =>
          company.roles.map((role) => role.name),
        ),
      ];
      return names.length ? names.join(", ") : "—";
    },
  },
  {
    id: "created_by",
    header: "Created by",
    freezable: true,
    value: (user) => user.created_by_name,
    cell: (user) => user.created_by_name ?? "—",
  },
  {
    id: "created_at",
    header: "Created",
    sortable: true,
    freezable: true,
    value: (user) => new Date(user.created_at),
    cell: (user) => (
      <time dateTime={user.created_at} className="text-muted-foreground">
        {formatDate(user.created_at)}
      </time>
    ),
  },
];
