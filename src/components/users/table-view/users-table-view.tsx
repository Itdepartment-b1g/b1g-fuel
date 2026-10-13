"use client";

import { useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/common/data-table";
import { Pagination } from "@/components/common/pagination";
import { Input } from "@/components/ui/input";
import { paginateItems } from "@/lib/pagination";
import { sortTableRows, type TableSort } from "@/lib/table";
import type { UserSummary } from "@/server/schema/users_schema";
export function UserAssignments({ user }: { user: UserSummary }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {user.global_roles.map((role) => (
        <span
          key={role.id}
          className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
        >
          {role.name}
        </span>
      ))}
      {user.companies.flatMap((company) =>
        company.roles.map((role) => (
          <span
            key={`${company.id}-${role.id}`}
            title={company.name}
            className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
          >
            {role.name} 
          </span>
        )),
      )}
      {!user.global_roles.length &&
        !user.companies.some((company) => company.roles.length) && (
          <span className="text-sm text-muted-foreground">
            No roles assigned
          </span>
        )}
    </div>
  );
}

export function userInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "U"
  );
}
export function UserAvatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
    >
      {userInitials(name)}
    </span>
  );
}

const columns: DataTableColumn<UserSummary>[] = [
  {
    id: "name",
    header: "Name",
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
        {new Date(user.created_at).toLocaleDateString("en-PH", {
          year: "numeric",
          month: "short",
          day: "numeric",
          timeZone: "Asia/Manila",
        })}
      </time>
    ),
  },
];

export function UsersTable({
  users,
  sorting,
  onSortingChange,
  loading,
  onAssign,
}: {
  users: UserSummary[];
  sorting?: TableSort | null;
  onSortingChange?: (sorting: TableSort | null) => void;
  loading?: boolean;
  onAssign?: (user: UserSummary) => void;
}) {
  return (
    <DataTable
      data={users}
      columns={columns}
      rowKey={(user) => user.id}
      caption="Organization users and their assignments"
      sortingMode={onSortingChange ? "server" : "client"}
      sorting={sorting}
      onSortingChange={onSortingChange}
      multipleFrozenColumns
      loading={loading}
      actions={
        onAssign
          ? [
              {
                id: "assign",
                label: "Assign",
                icon: <Pencil />,
                description: "Assign company and roles",
                onSelect: onAssign,
              },
            ]
          : undefined
      }
    />
  );
}

/** Client-side integration example: pass a complete dataset, not one server page. */
export function UsersTableView({ users }: { users: UserSummary[] }) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<TableSort | null>(null);
  const records = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const filtered = users.filter(
      (user) =>
        user.name.toLocaleLowerCase().includes(query) ||
        (user.email ?? "").toLocaleLowerCase().includes(query),
    );
    return sortTableRows(
      filtered,
      sort ?? { field: "created_at", direction: "desc" },
      (user) =>
        sort?.field === "name" ? user.name : new Date(user.created_at),
      (user) => user.id,
    );
  }, [users, search, sort]);
  const result = paginateItems(records, page, limit);
  if (page !== result.page) setPage(result.page);
  return (
    <>
    <section className="overflow-hidden rounded-xl border bg-white">
      <div className="flex flex-wrap gap-3 border-b p-4">
        <Input
          type="search"
          aria-label="Search users"
          placeholder="Search users"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
      </div>
      <UsersTable
        users={result.items}
        sorting={sort}
        onSortingChange={(next) => {
          setSort(next);
          setPage(1);
        }}
      />
    </section>
    <Pagination
      metadata={result}
      onPrev={() => setPage(result.page - 1)}
      onNext={() => setPage(result.page + 1)}
      onPage={setPage}
      onLimitChange={(value) => {
        setLimit(value);
        setPage(1);
      }}
    />
    </>
  );
}
